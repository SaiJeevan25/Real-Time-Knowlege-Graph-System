import sys
import os
import re
import json
import logging
from functools import lru_cache
from transformers import pipeline
from functools import lru_cache 

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, to_timestamp
from pyspark.sql.types import StructType, StringType

from graph.graph_builder import add_node, add_edge, save_graph

# ─────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("kg-stream")

# ─────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────
KAFKA_BROKER   = os.getenv("KAFKA_BROKER",  "localhost:9092")
KAFKA_TOPIC    = os.getenv("KAFKA_TOPIC",   "knowledge-stream-v2")
NER_MODEL      = os.getenv("NER_MODEL",     "dslim/bert-base-NER")
CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR", "file:///tmp/kg_checkpoints")
SAVE_EVERY_N   = int(os.getenv("SAVE_EVERY_N", "1"))   # save graph every N batches

# ─────────────────────────────────────────────────────────────────────
# RELATION RULES
# Each rule: (regex_pattern, relation_label, src_idx, tgt_idx)
#   src_idx / tgt_idx index into the entity list for that sentence.
#   Use -1 for last entity.
# ─────────────────────────────────────────────────────────────────────
RELATION_RULES = [
    # M&A / investment
    (r"\bacquired?\b",          "acquired",          0,  1),
    (r"\bmerged?\s+with\b",     "merged_with",       0,  1),
    (r"\binvested?\s+in\b",     "invested_in",       0,  1),
    (r"\bfunded?\b",            "funded",            0,  1),

    # Partnership / collaboration
    (r"\bpartnered?\s+with\b",  "partnered_with",    0,  1),
    (r"\bcollaborat\w+\b",      "collaborated_with", 0,  1),
    (r"\bjoint\s+venture\b",    "joint_venture",     0,  1),
    (r"\bsigned\s+a\b",         "signed_deal_with",  0,  1),

    # Employment / leadership
    (r"\bappointed?\b",         "appointed",         1,  0),   # entity1 appointed to entity0
    (r"\bhired?\b",             "hired",             0,  1),
    (r"\bnamed?\s+\w+\s+of\b",  "leads",             1,  0),
    (r"\bceo\s+of\b",           "ceo_of",            0,  1),

    # Geopolitical
    (r"\bmet\s+(with\s)?\b",    "met_with",          0,  1),
    (r"\bvisited?\b",           "visited",           0, -1),
    (r"\bhosted?\b",            "hosted",            0, -1),
    (r"\bsanctioned?\b",        "sanctioned",        0,  1),

    # Location / operations
    (r"\bopened?\b",            "located_in",        0, -1),
    (r"\blaunched?\s+in\b",     "launched_in",       0, -1),
    (r"\bexpanded?\s+in\b",     "expanded_in",       0, -1),
    (r"\bheadquartered?\s+in\b","headquartered_in",  0, -1),

    # Sports
    (r"\bsigned?\b",            "signed_by",         0,  1),
    (r"\bdefeated?\b",          "defeated",          0,  1),
    (r"\bscored?\b",            "scored_for",        0,  1),

    # Finance
    (r"\bacquired?\s+by\b",     "acquired_by",       0,  1),
    (r"\blisted?\s+on\b",       "listed_on",         0, -1),
]

# Compile once
COMPILED_RULES = [
    (re.compile(pat, re.IGNORECASE), label, src, tgt)
    for pat, label, src, tgt in RELATION_RULES
]

# ─────────────────────────────────────────────────────────────────────
# NER — loaded once per executor process via module-level singleton
# ─────────────────────────────────────────────────────────────────────
_ner = None



@lru_cache(maxsize=1)
def get_ner():

    log.info("Loading NER model: %s", NER_MODEL)

    return pipeline(
        "ner",
        model=NER_MODEL,
        aggregation_strategy="simple",
        device=-1,
    )

# ─────────────────────────────────────────────────────────────────────
# ENTITY HELPERS
# ─────────────────────────────────────────────────────────────────────

# Blocklist for garbage NER outputs
_BLOCKLIST = {
    "", "the", "a", "an", "and", "or", "of", "in", "to", "for",
    "is", "was", "has", "have", "##", "%",
}

def clean_word(word: str) -> str:
    """Strip subword artifacts and punctuation."""
    w = word.replace("##", "").strip(" .,;:!?\"'()")
    return w

def extract_entities(text: str) -> list[tuple[str, str]]:
    """
    Run NER and return deduplicated (name, type) list,
    preserving first-occurrence order.
    """
    ner = get_ner()
    try:
        raw = ner(text)
    except Exception as e:
        log.warning("NER failed on text '%s…': %s", text[:60], e)
        return []

    seen   = set()
    result = []
    for ent in raw:
        name  = clean_word(ent["word"])
        etype = ent["entity_group"]
        key   = name.lower()

        if key in _BLOCKLIST or len(name) < 2:
            continue
        if key in seen:
            continue

        seen.add(key)
        result.append((name, etype))

    return result

# ─────────────────────────────────────────────────────────────────────
# RELATION EXTRACTION
# ─────────────────────────────────────────────────────────────────────

def safe_idx(lst: list, idx: int):
    """Index a list safely, supporting -1 for last."""
    if not lst:
        return None
    try:
        return lst[idx]
    except IndexError:
        return None

def extract_relations(text: str, entities: list[tuple[str, str]]) -> list[tuple[str, str, str]]:
    """
    Return list of (src_name, tgt_name, relation_label) triples.
    Multiple rules can fire on the same sentence.
    """
    if len(entities) < 2:
        return []

    triples = []
    for pattern, label, src_idx, tgt_idx in COMPILED_RULES:
        if pattern.search(text):
            src = safe_idx(entities, src_idx)
            tgt = safe_idx(entities, tgt_idx)
            if src and tgt and src[0] != tgt[0]:
                triples.append((src[0], tgt[0], label))

    return triples

# ─────────────────────────────────────────────────────────────────────
# BATCH PROCESSOR
# ─────────────────────────────────────────────────────────────────────
_batch_counter = 0

def process_batch(batch_df, epoch_id):
    global _batch_counter

    rows = batch_df.collect()
    if not rows:
        log.info("Epoch %d — empty batch, skipping.", epoch_id)
        return

    log.info("Epoch %d — processing %d rows.", epoch_id, len(rows))

    nodes_added    = 0
    edges_added    = 0
    errors         = 0

    for row in rows:
        text      = (row["text"] or "").strip()
        category  = (row["category"] or "misc").strip()
        row_id    = row["id"] or "?"
        timestamp = row["timestamp"] or ""

        if not text:
            continue

        try:
            # ── 1. NER ──────────────────────────────────────────────
            entities = extract_entities(text)

            # ── 2. Write nodes ──────────────────────────────────────
            for name, etype in entities:
                add_node(name, etype, meta={"category": category, "timestamp": timestamp})
                nodes_added += 1

            # ── 3. Relation extraction ───────────────────────────────
            triples = extract_relations(text, entities)

            for src, tgt, label in triples:
                add_edge(src, tgt, label, meta={"text": text, "category": category})
                edges_added += 1

            # ── 4. Fallback: co-occurrence edge if no rule fired ─────
            if not triples and len(entities) >= 2:
                add_edge(
                    entities[0][0], entities[1][0],
                    "co_occurs_with",
                    meta={"text": text, "category": category},
                )
                edges_added += 1

            log.info(
                "[%s] id=%-4s  ents=%-3d  edges=%-3d  | %s",
                category.upper()[:10], row_id,
                len(entities), len(triples) or 1,
                text[:80],
            )

        except Exception as e:
            errors += 1
            log.error("Row id=%s failed: %s | text: %s…", row_id, e, text[:60])

    # ── 5. Persist graph ────────────────────────────────────────────
    _batch_counter += 1
    if _batch_counter % SAVE_EVERY_N == 0:
        try:
            save_graph()
            log.info(
                "Graph saved. nodes_added=%d  edges_added=%d  errors=%d",
                nodes_added, edges_added, errors,
            )
        except Exception as e:
            log.error("save_graph() failed: %s", e)

# ─────────────────────────────────────────────────────────────────────
# SPARK SESSION
# ─────────────────────────────────────────────────────────────────────

def build_spark() -> SparkSession:
    return (
        SparkSession.builder
        .appName("KnowledgeGraphStreaming")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.executor.memory", "2g")
        .config("spark.driver.memory", "2g")

        # 🔥 ADD THIS (VERY IMPORTANT)
        .config("spark.hadoop.fs.defaultFS", "file:///")

        .config("spark.streaming.kafka.maxRatePerPartition", "100")
        .getOrCreate()
    )
# ─────────────────────────────────────────────────────────────────────
# SCHEMA
# ─────────────────────────────────────────────────────────────────────

SCHEMA = (
    StructType()
    .add("id",        StringType())
    .add("category",  StringType())
    .add("text",      StringType())
    .add("timestamp", StringType())
)

# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────

def main():
    spark = build_spark()
    spark.sparkContext.setLogLevel("ERROR")

    log.info("Connecting to Kafka  broker=%s  topic=%s", KAFKA_BROKER, KAFKA_TOPIC)

    raw = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKER)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")       # tolerate Kafka log compaction
        .option("maxOffsetsPerTrigger", "200")   # cap per micro-batch
        .load()
    )

    parsed = (
        raw
        .selectExpr("CAST(value AS STRING) AS value")
        .select(from_json(col("value"), SCHEMA).alias("d"))
        .select("d.*")
        .filter(col("text").isNotNull())         # drop malformed messages early
    )

    query = (
        parsed.writeStream
        .foreachBatch(process_batch)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .trigger(processingTime="5 seconds")    # micro-batch every 5 s
        .start()
    )

    log.info("Streaming started. Awaiting termination…")
    try:
        query.awaitTermination()
    except KeyboardInterrupt:
        log.info("Interrupted — stopping query.")
        query.stop()


if __name__ == "__main__":
    main()