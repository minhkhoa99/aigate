#!/usr/bin/env node
// pnpm parity <command> (spec §8; docs/contracts/parity.md)
//   record [--only a,b]  record tapes from 9router (NINEROUTER_URL, default http://localhost:20128; NINEROUTER_PASSWORD, default 123456)
//   replay               tier 1 (fails on an undeclared difference) and tier 3 (warnings) against AIGate
//   live                 tier 2 against the real vendor (needs OPENAI_API_KEY; spends a few tokens)
//   gate [--out file]    the M1 acceptance gate: replay + golden scenarios + coverage (+ tier 2 if a key is set)
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { coverage } from "./coverage.mjs";
import { live } from "./live.mjs";
import { record } from "./record.mjs";
import { loadTapes, replayAll } from "./replay.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const [command, ...args] = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function golden() {
  const run = spawnSync(process.execPath, ["--test", "--test-timeout=30000", "apps/server/test/golden.test.mjs"], { cwd: ROOT, encoding: "utf8" });
  const count = (name) => Number(run.stdout.match(new RegExp(`^# ${name} (\\d+)`, "m"))?.[1] ?? 0);
  const skipped = [...run.stdout.matchAll(/^ok \d+ - (golden: [^#\n]+?) # SKIP (.+)$/gm)].map(([, name, reason]) => `${name.trim()} — ${reason}`);
  return { pass: count("pass"), fail: count("fail"), skipped, ok: run.status === 0 };
}

function report({ results, cov, gold, tier2 }) {
  const tier1 = results.filter((r) => r.tier1.pass).length;
  const lines = [
    "# Parity report (M1 gate)", "",
    `Generated ${new Date().toISOString()} by \`pnpm parity gate\`. Tapes recorded from ${[...new Set(results.map((r) => r.gateway))].join(", ")}.`, "",
    "| Check | Result |", "|---|---|",
    `| Tier 1, client contract | ${tier1}/${results.length} tapes PASS |`,
    `| Tier 2, vendor acceptance | ${tier2 ? `${tier2.filter((t) => t.pass).length}/${tier2.length} PASS (live)` : "not run (set OPENAI_API_KEY and run `pnpm parity live`)"} |`,
    `| Tier 3, upstream drift | ${results.reduce((n, r) => n + r.tier3.length, 0)} warnings (non-blocking) |`,
    `| Golden scenarios | ${gold.pass} pass, ${gold.fail} fail, ${gold.skipped.length} deferred |`,
    `| Coverage (tapes / docs/capabilities.md) | ${cov.covered}/${cov.total} |`,
    `| Matrix parityStatus | ${Object.entries(cov.statuses).map(([k, v]) => `${k} ${v}`).join(", ")} |`,
    "", "## Tapes", "", "| Tape | Tier 1 | Intentional deviations | Tier 3 warnings |", "|---|---|---|---|",
    ...results.map((r) => `| ${r.id} | ${r.tier1.pass ? "PASS" : `FAIL: ${r.tier1.problems.join("; ")}`} | ${r.deviations.map((d) => `\`${d.path}\` (${d.label}, ${d.entry})`).join("<br>") || "none"} | ${r.tier3.join(", ") || "none"} |`),
    "", "## Deferred golden scenarios", "", ...gold.skipped.map((s) => `- ${s}`),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  if (command === "record") {
    const only = option("only")?.split(",");
    const lines = await record({ base: process.env.NINEROUTER_URL ?? "http://localhost:20128", password: process.env.NINEROUTER_PASSWORD ?? "123456", only });
    console.log(lines.join("\n"));
    return 0;
  }
  if (!["replay", "live", "gate"].includes(command)) {
    console.error("usage: pnpm parity <record|replay|live|gate> [--only ids] [--out file]");
    return 2;
  }
  const tapes = await loadTapes();
  const results = await replayAll(tapes);
  for (const r of results) r.deviations = SCENARIOS.find((s) => s.id === r.id)?.deviations ?? [];
  if (command === "replay") {
    for (const r of results) {
      console.log(`${r.tier1.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(22)} tier3: ${r.tier3.join(", ") || "-"}`);
      for (const p of r.tier1.problems) console.log(`      ${p}`);
    }
    return results.every((r) => r.tier1.pass) ? 0 : 1;
  }
  const key = process.env.OPENAI_API_KEY;
  const tier2 = key ? await live(results, key) : undefined;
  if (command === "live") {
    if (!tier2) { console.error("Set OPENAI_API_KEY to run tier 2."); return 1; }
    for (const t of tier2) console.log(`${t.pass ? "PASS" : "FAIL"}  ${t.id.padEnd(22)} ${t.status} ${t.detail}`);
    return tier2.every((t) => t.pass) ? 0 : 1;
  }
  const gold = golden();
  const text = report({ results, cov: await coverage(tapes), gold, tier2 });
  const out = option("out");
  if (out) writeFileSync(out, text);
  console.log(text);
  return results.every((r) => r.tier1.pass) && gold.ok && (!tier2 || tier2.every((t) => t.pass)) ? 0 : 1;
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
