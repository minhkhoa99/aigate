"""Generate docs/PROJECT_MAP.md from the graphify extraction.

Deterministic: every cell comes from an edge in .graphify_extract.json.
Re-run after `/graphify docs --update` to keep the map in sync.
"""
import json
from collections import defaultdict
from pathlib import Path

ext = json.loads(Path("graphify-out/extract.json").read_text(encoding="utf-8"))
label = {n["id"]: n["label"] for n in ext["nodes"]}
out_e, in_e = defaultdict(list), defaultdict(list)
for e in ext["edges"]:
    out_e[e["source"]].append(e)
    in_e[e["target"]].append(e)


def nbrs(nid, prefix, rel=None, direction="out"):
    pool = out_e[nid] if direction == "out" else in_e[nid]
    key = "target" if direction == "out" else "source"
    res = []
    for e in pool:
        o = e[key]
        if o.startswith(prefix) and (rel is None or e["relation"] == rel) and o not in res:
            res.append((o, e["confidence"]))
    return res


def fmt(items, short=lambda i: i):
    if not items:
        return "—"
    return ", ".join(short(i) + ("?" if c == "AMBIGUOUS" else "") for i, c in items)


ctx = lambda i: i.removeprefix("ctx_")
grp = lambda i: i.removeprefix("group_")
scr = lambda i: i.removeprefix("screen_")
ds = lambda i: i.removeprefix("ds_")
aud = lambda i: i.removeprefix("audit_")
sp = lambda i: i.removeprefix("sp_").upper()

U = [f"sp_u{i}" for i in range(12)]
# route groups that exist only at spec level (§10.8); the Stitch briefs split them into real screens
SPEC_ONLY = {"screen_auth", "screen_settings"}
lines = [
    "# AIGate — Project Map",
    "",
    "> **GENERATED** by `graphify-out/build_project_map.py` from the knowledge graph",
    "> (`graphify-out/graph.json`). Do not hand-edit — change the source docs, re-run",
    "> `/graphify docs --update`, then `python graphify-out/build_project_map.py`.",
    ">",
    "> `?` = edge marked AMBIGUOUS in the graph (the source docs do not settle it).",
    "",
    "Đọc file này trước khi làm bất kỳ màn UI hay bounded context nào. Nó trả lời:",
    "màn này thuộc U-project nào, lấy dữ liệu từ context backend nào, phải chờ SP",
    "backend nào xong, map về feature nào của 9router, dùng component design nào,",
    "và audit Stitch đã bắt lỗi gì ở nó.",
    "",
    "Nguồn: `docs/superpowers/specs/2026-09-22-aigate-design.md` (spec — thắng khi mâu thuẫn),",
    "`docs/design/stitch-briefs.md`, `docs/design/DESIGN.md`, `docs/design/stitch-audit.md`,",
    "`docs/superpowers/plans/2026-09-22-m1-discovery.md`, `docs/governance/*.md`.",
    "",
    "## 1 · Lộ trình",
    "",
    "`M-1 Discovery → M0 Foundation → M1 Walking skeleton → M2 Scale-out → M3 UI`",
    "",
    "| Milestone | Sub-project |",
    "|---|---|",
]
for ms in ["ms_m_minus_1", "ms_m0", "ms_m1", "ms_m2", "ms_m3"]:
    kids = [t for t, _ in nbrs(ms, "sp_", "references")]
    if ms == "ms_m_minus_1":
        kids += [t for t, _ in nbrs(ms, "task_", "references")]
    kids = sorted(set(kids), key=lambda k: (k[:4], int("".join(ch for ch in k if ch.isdigit()) or 0)))
    lines.append(f"| {label.get(ms, ms)} | {', '.join(sp(k) if k.startswith('sp_') else k.removeprefix('task_')[:2].lstrip('0') and 'T' + k.split('_')[1] for k in kids) or '—'} |")

lines += ["", "## 2 · UI sub-project (M3) — thứ tự dựng", "",
          "| U | Nội dung | Màn | Phụ thuộc U | Chờ context | Chờ SP backend |",
          "|---|---|---|---|---|---|"]
for u in U:
    screens = [x for x in nbrs(u, "screen_", "implements") if x[0] not in SPEC_ONLY]
    deps_u = [(t, c) for t, c in nbrs(u, "sp_u", "conceptually_related_to")]
    deps_c = nbrs(u, "ctx_", "conceptually_related_to")
    deps_sp = [(t, c) for t, c in nbrs(u, "sp_sp", "conceptually_related_to")]
    lines.append(f"| {sp(u)} | {label.get(u, u)} | {fmt(screens, scr)} | {fmt(deps_u, sp)} | {fmt(deps_c, ctx)} | {fmt(deps_sp, sp)} |")

# screens: chunk-3 granular ids, inheriting from the spec-level parent screen
parent = {}
for s in label:
    if s.startswith("screen_"):
        for t, _ in nbrs(s, "screen_", "conceptually_related_to"):
            if any(e["source_location"] == "§10.8 route group" for e in out_e[s] if e["target"] == t):
                parent[t] = s


def inherit(s, fn):
    got = fn(s)
    return got or (fn(parent[s]) if s in parent else [])


lines += ["", "## 3 · Màn hình → backend → feature → design", "",
          "| Màn | U | Context backend | Feature 9router | Component design | Tái dùng pattern của | Lỗi audit |",
          "|---|---|---|---|---|---|---|"]
for s in sorted(i for i in label if i.startswith("screen_")):
    if s in SPEC_ONLY:
        continue  # spec-level route group, folded into its per-screen children
    u = inherit(s, lambda x: nbrs(x, "sp_u", "implements", "in"))
    c = inherit(s, lambda x: nbrs(x, "ctx_", "references"))
    g = inherit(s, lambda x: nbrs(x, "group_", "references"))
    d = nbrs(s, "ds_", "references")
    reuse = [(t, cf) for t, cf in nbrs(s, "screen_", "conceptually_related_to") if parent.get(t) != s]
    a = nbrs(s, "audit_", None, "in")
    lines.append(f"| **{label[s]}** | {fmt(u, sp)} | {fmt(c, ctx)} | {fmt(g, grp)} | {fmt(d, ds)} | {fmt(reuse, scr)} | {fmt(a, aud)} |")

lines += ["", "## 4 · Bounded context → ai dùng nó", "",
          "| Context | Gánh gì | SP backend dựng nó | Màn hiển thị nó | Port |", "|---|---|---|---|---|"]
for cid in sorted(i for i in label if i.startswith("ctx_")):
    why = next((n.get("rationale") for n in ext["nodes"] if n["id"] == cid and n.get("rationale")), "")
    sps = nbrs(cid, "sp_sp", "implements", "in")
    screens = [(s, cf) for s, cf in nbrs(cid, "screen_", "references", "in") if s not in SPEC_ONLY]
    ports = nbrs(cid, "port_", None) + nbrs(cid, "port_", None, "in")
    lines.append(f"| `{ctx(cid)}` | {why or label[cid]} | {fmt(sps, sp)} | {fmt(screens, scr)} | {fmt(ports, lambda p: p.removeprefix('port_'))} |")

lines += ["", "## 5 · Lỗi / khoảng trống đã biết", ""]
for n in ext["nodes"]:
    if n["id"].startswith(("audit_", "gap_")):
        hits = [scr(t) for t, _ in nbrs(n["id"], "screen_", "references")]
        fix = [sp(t) for t, _ in nbrs(n["id"], "sp_u", "references")]
        lines.append(f"- **{n['label']}**" + (f" — màn: {', '.join(hits)}" if hits else "") + (f" — sửa ở: {', '.join(fix)}" if fix else ""))
amb = [e for e in ext["edges"] if e["confidence"] == "AMBIGUOUS"]
lines += ["", f"Cạnh AMBIGUOUS cần người quyết: **{len(amb)}**", ""]
for e in amb:
    lines.append(f"- {label.get(e['source'], e['source'])} → {label.get(e['target'], e['target'])} (`{e['relation']}`, {e.get('source_location') or ''})")

lines += ["", "## 6 · Tra cứu sâu hơn", "",
          "```bash",
          "/graphify query \"màn Connections cần backend nào\"      # BFS quanh một khái niệm",
          "/graphify path \"U4\" \"SP16\"                            # đường nối giữa hai node",
          "/graphify explain \"routing\"                            # giải thích một node",
          "```",
          "", "Graph trực quan: mở `graphify-out/graph.html`. Báo cáo cụm: `graphify-out/GRAPH_REPORT.md`.", ""]
Path("docs/PROJECT_MAP.md").write_text("\n".join(lines), encoding="utf-8")
print("docs/PROJECT_MAP.md:", len(lines), "lines")
