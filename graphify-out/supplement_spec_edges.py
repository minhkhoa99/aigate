"""Add spec edges the chunk-1 extraction missed. Every edge cites a spec table."""
import json
from pathlib import Path

SRC = "docs/superpowers/specs/2026-09-22-aigate-design.md"
p = Path("graphify-out/extract.json")
ext = json.loads(p.read_text(encoding="utf-8"))
ids = {n["id"] for n in ext["nodes"]}
have = {(e["source"], e["target"], e["relation"]) for e in ext["edges"]}
added = []


def edge(s, t, rel, score=1.0, loc=None):
    conf = "EXTRACTED" if score == 1.0 else ("AMBIGUOUS" if score <= 0.3 else "INFERRED")
    if s not in ids or t not in ids or (s, t, rel) in have:  # idempotent
        return
    e = {"source": s, "target": t, "relation": rel, "confidence": conf, "confidence_score": score,
         "source_file": SRC, "source_location": loc, "weight": 1.0}
    ext["edges"].append(e); have.add((s, t, rel)); added.append(e)


# §10.10 — U-project owns its screens (chunk-3 granular ids)
UI = {"sp_u2": ["login", "callback", "onboarding", "settings_general", "settings_auth", "settings_developer"],
      "sp_u4": ["provider_detail", "authflow"], "sp_u7": ["request_detail"],
      "sp_u9": ["deploy_wizard"], "sp_u10": ["cli_tool_detail"]}
for u, ss in UI.items():
    for s in ss:
        edge(u, f"screen_{s}", "implements", 1.0, "§10.10")
for u in [f"sp_u{i}" for i in range(2, 11)]:
    edge(u, "sp_u1", "conceptually_related_to", 0.95, "§10.10 (every screen needs the shell)")
# §10.10 "Phụ thuộc: M2 <context>" → the backend SP that builds that context (§9)
for u, sps in {"sp_u2": [5, 6], "sp_u3": [6], "sp_u4": [11, 16, 17], "sp_u5": [23], "sp_u6": [19, 20],
               "sp_u7": [24], "sp_u9": [18], "sp_u10": [25]}.items():
    for n in sps:
        edge(u, f"sp_sp{n}", "conceptually_related_to", 0.95, "§10.10 + §9")

# §10.8 #4 vs §10.10 — Token Saver screen has no owning U-project
if "gap_token_saver_unowned" not in ids: ext["nodes"].append({"id": "gap_token_saver_unowned", "label": "GAP: Token Saver screen missing from the U0–U11 table",
                     "file_type": "rationale", "source_file": SRC, "source_location": "§10.8 vs §10.10",
                     "source_url": None, "captured_at": None, "author": None, "contributor": None,
                     "rationale": "Screen #4 sits in the Gateway group beside Routing; U6 is the likely owner but the spec never says"})
ids.add("gap_token_saver_unowned")
edge("gap_token_saver_unowned", "screen_token_saver", "references", 1.0, "§10.10")
edge("gap_token_saver_unowned", "sp_u6", "references", 0.3, "§10.10")
edge("sp_u6", "screen_token_saver", "implements", 0.3, "§10.8 vs §10.10")

# §4.4 + §10.8 — screen → owning bounded context
for s, c, score in [
    ("token_saver", "routing", 1.0), ("cli_tools", "tooling", 1.0), ("cli_tool_detail", "tooling", 1.0),
    ("skills", "tooling", 1.0), ("mcp", "tooling", 1.0), ("tunnel", "tooling", 1.0), ("console", "tooling", 1.0),
    ("mitm", "tooling", 1.0), ("mitm", "transport", 0.85), ("proxy_pools", "transport", 1.0),
    ("deploy_wizard", "transport", 1.0), ("llm_providers", "catalog", 1.0), ("llm_providers", "connections", 0.85),
    ("provider_detail", "catalog", 1.0), ("provider_detail", "connections", 1.0), ("connections", "connections", 1.0),
    ("authflow", "connections", 1.0), ("media_providers", "media", 1.0), ("quota", "usage", 1.0),
    ("usage", "usage", 1.0), ("requests", "usage", 1.0), ("request_detail", "usage", 1.0),
    ("endpoint_keys", "apikeys", 1.0), ("routing_fallback", "routing", 1.0),
    ("settings_general", "settings", 1.0), ("settings_developer", "settings", 1.0),
    ("settings_auth", "identity", 1.0), ("settings_auth", "apikeys", 0.85),
    ("login", "identity", 1.0), ("callback", "identity", 1.0),
    ("onboarding", "identity", 0.85), ("onboarding", "connections", 0.85), ("onboarding", "apikeys", 0.85),
    ("overview", "usage", 0.85), ("overview", "connections", 0.75), ("overview", "catalog", 0.75),
]:
    edge(f"screen_{s}", f"ctx_{c}", "references", score, "§4.4 + §10.8")

# §10.8 "Nguồn ở 9router" — screen → 9router feature group
for s, g in [("skills", "skills"), ("mcp", "mcp"), ("tunnel", "remote_functionality"), ("cli_tools", "cli_tools"),
             ("connections", "multi_account"), ("connections", "provider_account_management"),
             ("authflow", "oauth_providers"), ("authflow", "apikey_providers"), ("provider_detail", "model_registry"),
             ("provider_detail", "model_mapping"), ("usage", "usage"), ("proxy_pools", "proxy_pools"),
             ("settings_general", "translation_language")]:
    edge(f"screen_{s}", f"group_{g}", "references", 0.85, "§10.8")

p.write_text(json.dumps(ext, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"added {len(added)} edges (+1 gap node); total {len(ext['nodes'])} nodes, {len(ext['edges'])} edges")

# ── pass 2: §9 SP → context (every SP row names the context it builds) ──
ext = json.loads(p.read_text(encoding="utf-8"))
ids = {n["id"] for n in ext["nodes"]}
have = {(e["source"], e["target"], e["relation"]) for e in ext["edges"]}
added = []
for n, ctxs in {4: [("catalog", .85)], 5: [("settings", 1.0)], 6: [("identity", 1.0), ("apikeys", 1.0)],
                7: [("routing", .85), ("catalog", .85)], 8: [("transport", 1.0)], 9: [("routing", .85)],
                10: [("routing", .85)], 11: [("connections", 1.0)], 12: [("routing", 1.0)], 13: [("catalog", .95)],
                14: [("routing", .85)], 15: [("routing", .85)], 16: [("connections", .95)],
                17: [("connections", .95), ("routing", .85)], 18: [("transport", 1.0)], 19: [("routing", .95)],
                20: [("routing", .95)], 21: [("routing", .95)], 22: [("routing", .95)], 23: [("media", 1.0)],
                24: [("usage", 1.0)], 25: [("tooling", 1.0)]}.items():
    for c, score in ctxs:
        edge(f"sp_sp{n}", f"ctx_{c}", "implements", score, "§9")
p.write_text(json.dumps(ext, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"pass 2: added {len(added)} SP→context edges")
