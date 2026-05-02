from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from functools import lru_cache
from typing import Dict, Any

app = FastAPI(title="Knowledge Graph API")

# -------------------------------
# CORS (for frontend)
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GRAPH_FILE = "graph_data.json"

# -------------------------------
# UTIL (CACHED GRAPH LOADER)
# -------------------------------
@lru_cache(maxsize=1)
def load_graph_cached() -> Dict[str, Any]:
    if not os.path.exists(GRAPH_FILE):
        return {"nodes": [], "edges": []}

    with open(GRAPH_FILE, "r") as f:
        return json.load(f)


def load_graph():
    # Always refresh cache (since file updates frequently)
    load_graph_cached.cache_clear()
    return load_graph_cached()


# -------------------------------
# ROOT
# -------------------------------
@app.get("/")
def home():
    return {"message": "🚀 Knowledge Graph API Running"}


# -------------------------------
# GRAPH ENDPOINTS
# -------------------------------
@app.get("/graph")
def get_graph():
    return load_graph()


# 🔥 FIX: for frontend calls
@app.get("/knowledge")
def get_knowledge():
    return load_graph()


# -------------------------------
# ANALYTICS
# -------------------------------
@app.get("/analytics")
def analytics():
    data = load_graph()
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    return {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "density": round(len(edges) / max(len(nodes), 1), 2)
    }


# 🔥 FIX: alias endpoint
@app.get("/stats")
def stats():
    return analytics()


# -------------------------------
# NODE EXPANSION
# -------------------------------
@app.get("/expand/{node_id}")
def expand(node_id: str):
    data = load_graph()
    edges = data.get("edges", [])

    neighbors = set()

    for edge in edges:
        if edge["source"] == node_id:
            neighbors.add(edge["target"])
        elif edge["target"] == node_id:
            neighbors.add(edge["source"])

    return {
        "node": node_id,
        "neighbors": list(neighbors)
    }


# -------------------------------
# EXTRA (OPTIONAL BUT USEFUL)
# -------------------------------

# Get nodes only
@app.get("/nodes")
def get_nodes():
    return load_graph().get("nodes", [])


# Get edges only
@app.get("/edges")
def get_edges():
    return load_graph().get("edges", [])


# Search nodes
@app.get("/search/{query}")
def search(query: str):
    data = load_graph()
    nodes = data.get("nodes", [])

    results = [n for n in nodes if query.lower() in n["label"].lower()]

    return {
        "query": query,
        "results": results
    }


# -------------------------------
# HEALTH
# -------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}