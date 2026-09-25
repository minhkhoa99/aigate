// Verification by diff (spec §9, SP4 exit criterion; docs/contracts/registry-extract.md).
// Compares the generated CATALOG with 9router's registry read straight from the source, field by field,
// without going through extract.mjs's mapping, so a mapping bug cannot verify itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readSource } from "./extract.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FORMAT_TO_PROTOCOL = { openai: "openai-compatible", claude: "anthropic" };
const CAPABILITY_KEYS = ["vision", "pdf", "audioInput", "videoInput", "tools", "reasoning"];

// Every string value under an oauth block or a client key: none of them may reach the catalog.
function secretValues(entry) {
  const out = [];
  const walk = (value, key) => {
    if (typeof value === "string" && value.length >= 8 && /secret|client|token/i.test(key)) out.push(value);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(entry.oauth, "oauth");
  walk({ clientSecret: entry.transport?.clientSecret, clientId: entry.transport?.clientId }, "transport");
  return out;
}

export async function verify() {
  const source = await readSource();
  const { CATALOG, validateCatalog } = await import(pathToFileURL(join(ROOT, "packages/engine/dist/index.js")).href);
  const generatedText = readFileSync(join(ROOT, "packages/engine/src/catalog/providers.generated.ts"), "utf8");
  const differences = [];
  const expect = (where, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) differences.push(`${where}: catalog ${JSON.stringify(actual)}, source ${JSON.stringify(expected)}`);
  };
  const defaults = source.capabilities.DEFAULT_CAPABILITIES;

  expect("provider ids (in order)", CATALOG.map((p) => p.id), source.registry.map((e) => e.id));
  let models = 0;
  for (const entry of source.registry) {
    const p = CATALOG.find((c) => c.id === entry.id);
    if (!p) continue;
    const at = `provider ${entry.id}`;
    expect(`${at} name`, p.name, entry.display?.name ?? entry.id);
    expect(`${at} category`, p.category, entry.category);
    expect(`${at} chatUrl`, p.chatUrl, entry.transport?.baseUrl || null);
    expect(`${at} modelsUrl`, p.modelsUrl, entry.transport?.modelsUrl ?? entry.transport?.validateUrl ?? null);
    const format = entry.transport ? entry.transport.format ?? "openai" : null;
    expect(`${at} protocol`, p.protocol, format === null ? "service" : FORMAT_TO_PROTOCOL[format] ?? format);
    if (entry.noAuth) expect(`${at} auth`, p.auth.kinds, ["none"]);
    if (entry.oauth && !entry.noAuth) expect(`${at} auth has oauth`, p.auth.kinds.includes("oauth"), true);
    expect(`${at} hidden`, p.hidden, Boolean(entry.hidden));
    expect(`${at} headers`, p.headers, entry.transport?.headers ?? {});
    expect(`${at} forceStream`, p.forceStream, entry.transport?.forceStream === true);
    expect(`${at} quirks`, [...p.quirks].sort(), Object.keys(entry.transport?.quirks ?? {}).sort());
    const raw = entry.models ?? [];
    expect(`${at} model ids (in order)`, p.models.map((m) => m.id), raw.map((m) => m.id));
    for (const [i, rawModel] of raw.entries()) {
      const m = p.models[i];
      if (!m) continue;
      models++;
      const mat = `${at} model ${rawModel.id}`;
      expect(`${mat} upstreamModelId`, m.upstreamModelId, rawModel.upstreamModelId ?? null);
      expect(`${mat} kind`, m.kind, rawModel.kind ?? rawModel.type ?? "llm");
      const resolved = source.capabilities.getCapabilitiesForModel(entry.id, rawModel.id);
      // Independent probe: with the floor's limits hidden, a tier that states limits still shows them.
      const probe = { ...defaults };
      Object.assign(defaults, { contextWindow: NaN, maxOutput: NaN });
      let probed;
      try {
        probed = source.capabilities.getCapabilitiesForModel(entry.id, rawModel.id);
      } finally {
        Object.assign(defaults, probe);
      }
      const declaredBySource = rawModel.contextLength !== undefined || rawModel.maxOutputTokens !== undefined || !Number.isNaN(probed.contextWindow) || !Number.isNaN(probed.maxOutput);
      expect(`${mat} capabilitySource`, m.capabilitySource, declaredBySource ? "declared" : "default");
      for (const key of CAPABILITY_KEYS) expect(`${mat} ${key}`, m.capabilities[key], Boolean(rawModel.capabilities?.[key] ?? resolved[key]));
      if (m.capabilitySource === "declared") {
        if (m.contextWindow !== null) expect(`${mat} contextWindow`, m.contextWindow, rawModel.contextLength ?? resolved.contextWindow);
        if (m.maxOutputTokens !== null) expect(`${mat} maxOutputTokens`, m.maxOutputTokens, rawModel.maxOutputTokens ?? resolved.maxOutput);
      } else {
        // "default" must mean 9router fell back to its floor, whose limits AIGate refuses to copy.
        expect(`${mat} floor limits`, [resolved.contextWindow, resolved.maxOutput], [defaults.contextWindow, defaults.maxOutput]);
      }
    }
    for (const secret of secretValues(entry)) if (generatedText.includes(secret)) differences.push(`${at}: a credential value from the source appears in the catalog`);
  }
  const problems = validateCatalog(CATALOG);
  const undeclared = CATALOG.flatMap((p) => p.models).filter((m) => m.capabilitySource === "default").length;
  const report = [
    `9router ${source.version} (${source.commit.slice(0, 8)}): ${source.registry.length} providers, ${models} models checked`,
    `catalog: ${CATALOG.length} providers, ${CATALOG.reduce((n, p) => n + p.models.length, 0)} models (${undeclared} with no declared limits)`,
    `differences: ${differences.length}${differences.length ? `\n  ${differences.slice(0, 30).join("\n  ")}` : ""}`,
    `validateCatalog: ${problems.length} problems${problems.length ? `\n  ${problems.slice(0, 30).join("\n  ")}` : ""}`,
  ].join("\n");
  return { differences: [...differences, ...problems], report };
}
