"""Merge one hand-authored graphify chunk into the knowledge graph (used after each SP).

  python graphify-out/merge_chunk.py merge  .graphify_chunk_NN.json [stale_id,stale_id]
      Merge the chunk into extract.json (later chunks win on node attributes), drop the
      stale nodes and their edges, re-cluster, and print the communities to label.
  python graphify-out/merge_chunk.py finish labels.json "<new doc path>" "<cost note>"
      Write GRAPH_REPORT.md, graph.json, graph.html, manifest, and the cost entry.

Then run graphify-out/build_project_map.py. Use the Python312 interpreter (docs/PROGRESS_HANDOFF.md).
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from graphify.analyze import god_nodes, suggest_questions, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.detect import save_manifest
from graphify.export import to_html, to_json
from graphify.report import generate

OUT = Path("graphify-out")
ANALYSIS = Path(".graphify_analysis.json")


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def merge(chunk_file, stale_arg):
    ext = read(OUT / "extract.json")
    chunk = read(OUT / chunk_file)
    stale = {s for s in stale_arg.split(",") if s}
    ext["edges"] = [e for e in ext["edges"] if e["source"] not in stale and e["target"] not in stale]
    by_id = {n["id"]: n for n in ext["nodes"] if n["id"] not in stale}
    for n in chunk["nodes"]:
        by_id[n["id"]] = {**by_id.get(n["id"], {}), **n}
    ext["nodes"] = list(by_id.values())
    seen = {(e["source"], e["target"], e["relation"]) for e in ext["edges"]}
    for e in chunk["edges"]:
        key = (e["source"], e["target"], e["relation"])
        if key not in seen:
            ext["edges"].append(e)
            seen.add(key)
    hyper = {h["id"]: h for h in ext.get("hyperedges", [])}
    hyper.update({h["id"]: h for h in chunk.get("hyperedges", [])})
    ext["hyperedges"] = list(hyper.values())
    dangling = [e for e in ext["edges"] if e["source"] not in by_id or e["target"] not in by_id]
    if dangling:
        raise SystemExit(f"dangling edges: {dangling[:5]}")
    (OUT / "extract.json").write_text(json.dumps(ext, indent=2, ensure_ascii=False), encoding="utf-8")
    graph = build_from_json(ext)
    communities = cluster(graph)
    ANALYSIS.write_text(json.dumps({
        "communities": {str(k): v for k, v in communities.items()},
        "cohesion": {str(k): v for k, v in score_all(graph, communities).items()},
        "gods": god_nodes(graph),
        "surprises": surprising_connections(graph, communities),
    }, indent=2), encoding="utf-8")
    print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities")
    for cid, members in sorted(communities.items()):
        print(cid, len(members), " | ".join(graph.nodes[m].get("label", m)[:38] for m in members[:6]))


def finish(labels_file, new_doc, note):
    ext = read(OUT / "extract.json")
    analysis = read(ANALYSIS)
    labels = {int(k): v for k, v in read(labels_file).items()}
    graph = build_from_json(ext)
    communities = {int(k): v for k, v in analysis["communities"].items()}
    cohesion = {int(k): v for k, v in analysis["cohesion"].items()}
    missing = set(communities) - set(labels)
    if missing:
        raise SystemExit(f"unlabeled communities: {sorted(missing)}")
    files = sorted(set(read(OUT / "manifest.json")) | {new_doc})
    words = sum(len(Path(f).read_text(encoding="utf-8").split()) for f in files if Path(f).exists())
    detection = {"files": {"document": files}, "total_files": len(files), "total_words": words, "needs_graph": True, "warning": None, "skipped_sensitive": []}
    cost = read(OUT / "cost.json")
    tokens = {"input": cost["total_input_tokens"], "output": cost["total_output_tokens"]}
    questions = suggest_questions(graph, communities, labels)
    report = generate(graph, communities, cohesion, labels, analysis["gods"], analysis["surprises"], detection, tokens, "docs", suggested_questions=questions)
    (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    to_json(graph, communities, str(OUT / "graph.json"))
    to_html(graph, communities, str(OUT / "graph.html"), community_labels=labels)
    save_manifest(detection["files"])
    cost["runs"].append({"date": datetime.now(timezone.utc).isoformat(), "input_tokens": 0, "output_tokens": 0, "files": 4, "mode": note})
    (OUT / "cost.json").write_text(json.dumps(cost, indent=2), encoding="utf-8")
    ANALYSIS.unlink()
    print(f"{graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities, {len(files)} files")


if __name__ == "__main__":
    if sys.argv[1] == "merge":
        merge(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        finish(sys.argv[2], sys.argv[3], sys.argv[4])
