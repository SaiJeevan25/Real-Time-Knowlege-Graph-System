import json

nodes = {}
edges = []
edge_set = set()

MAX_NODES = 1000
MAX_EDGES = 2000


def add_node(name, node_type, meta=None):
    if not name:
        return

    if name not in nodes:
        nodes[name] = {
            "id": name,
            "label": name,
            "type": node_type,
            "meta": meta or {}
        }

        # limit size
        if len(nodes) > MAX_NODES:
            nodes.pop(next(iter(nodes)))


def add_edge(source, target, relation, meta=None):
    key = (source, target, relation)

    if key not in edge_set:
        edge_set.add(key)

        edges.append({
            "source": source,
            "target": target,
            "label": relation,
            "meta": meta or {}
        })

        # limit size
        if len(edges) > MAX_EDGES:
            edges.pop(0)


def get_graph():
    return {
        "nodes": list(nodes.values()),
        "edges": edges
    }


def save_graph():
    with open("graph_data.json", "w") as f:
        json.dump(get_graph(), f, indent=2)