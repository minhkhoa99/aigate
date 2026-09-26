// One-off mutation run for SP14g: each mutation must make a suite fail. Restores every file afterwards.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ENGINE = "pnpm --filter @aigate/engine test";
const SERVER = "pnpm --filter @aigate/server test";
const r = "packages/engine/src/registry.ts";
const b = "packages/engine/src/builtin-registry.ts";
const o = "packages/engine/src/adapters/openai-compatible.ts";
const d = "apps/server/src/modules/connections/domain/connection.ts";
const c = "apps/server/src/modules/connections/infrastructure/connections.controller.ts";
const p = "apps/server/src/modules/connections/infrastructure/connections.repo.ts";

const mutations = [
  [r, "if (field && value) return field === \"baseUrl\" ? value.replace(/\\/$/, \"\") : encodeURIComponent(value);", "if (field && value) return value;", "values not encoded"],
  [r, "field === \"baseUrl\" ? value.replace(/\\/$/, \"\") : encodeURIComponent(value)", "encodeURIComponent(value)", "base url encoded"],
  [r, "return (field && fields.defaults?.[field]) || token;", "return token;", "defaults ignored"],
  [r, "...(organization ? { headers: { ...provider.headers, \"openai-organization\": organization } } : {}),", "", "organization header lost"],
  [r, "chatUrl: fill(provider.chatUrl), modelsUrl: fill(provider.modelsUrl),", "chatUrl: provider.chatUrl, modelsUrl: fill(provider.modelsUrl),", "chat url not filled"],
  [b, "\"cloudflare-ai\": [\"flattenContent\"],", "", "no flatten quirk"],
  [b, "\"x-client-type\": \"aigate\",", "\"x-client-type\": \"9router\",", "client type 9router"],
  [b, "\"user-agent\": `AIGate/${CLIENT_VERSION}`, ", "", "no user agent"],
  [b, "auth: { kind: \"api-key\", header: \"api-key\", scheme: \"raw\" },", "", "azure bearer auth"],
  [b, "defaults: { deployment: \"{model}\", apiVersion: \"2024-10-01-preview\" }", "defaults: { apiVersion: \"2024-10-01-preview\" }", "no model deployment"],
  [b, "deployment: \"{model}\", apiVersion: \"2024-10-01-preview\"", "deployment: \"{model}\", apiVersion: \"2024-06-01\"", "api version default"],
  [b, "invalidStatuses: [401, 403] },", "invalidStatuses: [401, 403, 404] },", "azure 404 invalid"],
  [b, "invalidStatuses: [401, 403, 404] },", "invalidStatuses: [401, 403] },", "cloudflare 404 valid"],
  [b, "chatProbe: { model: \"gpt-4\"", "chatProbe: { model: \"gpt-4o\"", "azure probe model"],
  [b, "body: { messages: PROBE_MESSAGES, max_completion_tokens: 1 }", "body: { messages: PROBE_MESSAGES, max_tokens: 1 }", "azure probe body"],
  [b, "body: { model, messages: PROBE_MESSAGES, max_tokens: 1 }", "body: { messages: PROBE_MESSAGES, max_tokens: 1 }", "cloudflare probe without model"],
  [b, "connectionFields: { required: [\"accountId\"], optional: [] },", "connectionFields: { required: [], optional: [\"accountId\"] },", "account id optional"],
  [b, "  if (PER_CONNECTION[provider.id]) return undefined;\n", "", "per-connection providers blocked"],
  [o, "if (other) throw unsupported(", "if (false) throw unsupported(", "image dropped"],
  [o, ".join(\"\");\n    }\n  }\n}", ".join(\" \");\n    }\n  }\n}", "flatten separator"],
  [o, "return body.success === true && isRecord(body.data) ? body.data : root;", "return root;", "envelope kept"],
  [o, "return body.success === true && isRecord(body.data)", "return isRecord(body.data)", "failure envelope unwrapped"],
  [o, "this.provider.quirks?.includes(\"clineEnvelope\") ? unwrapEnvelope(parsed) : parsed", "unwrapEnvelope(parsed)", "every provider unwraps"],
  [o, "if (this.provider.chatProbe) return this.probeChat(this.provider.chatProbe, credential, ctx);", "", "no chat probe"],
  [o, "if (!probe.invalidStatuses.includes(response.status)) {", "if (response.status < 400) {", "probe status rule"],
  [o, "const detail = this.clean(text(error.message), credential);", "const detail = text(error.message);", "probe detail not redacted"],
  [o, "if (missing) throw new EngineError(", "if (false) throw new EngineError(", "missing token sent"],
  [o, "template.replaceAll(\"{model}\", encodeURIComponent(model))", "template.replaceAll(\"{model}\", model)", "model not encoded"],
  [o, "this.url(this.provider.chatUrl, probe.model)", "this.url(this.provider.chatUrl, \"x\")", "probe model ignored"],
  [d, "deployment: { pattern: /^[\\w.-]{1,64}$/", "deployment: { pattern: /^.{1,64}$/", "deployment unchecked"],
  [d, "accountId: { pattern: /^[A-Za-z0-9-]{1,64}$/", "accountId: { pattern: /^.{1,64}$/", "account id unchecked"],
  [d, "const trimmed = typeof value === \"string\" ? value.trim() : \"\";", "const trimmed = typeof value === \"string\" ? value : \"\";", "not trimmed"],
  [d, "changes[field] = parsed.value ?? null;", "changes[field] = parsed.value;", "clear ignored"],
  [d, "if (parsed.value !== undefined) value[field] = parsed.value;", "", "fields not saved"],
  [c, "if (value && !takes(field)) throw invalid(", "if (false) throw invalid(", "any field accepted"],
  [c, "if (required && (creating ? !value : value === null)) throw invalid(", "if (required && creating && !value) throw invalid(", "required clear allowed"],
  [c, "if (required && (creating ? !value : value === null))", "if (required && !creating && value === null)", "required missing on create"],
  [p, "deployment: input.deployment ?? null,", "deployment: null,", "deployment not stored"],
  [p, "return { apiKey: this.cipher.open(sealed, sealContext(id)), ...rest };", "return { apiKey: this.cipher.open(sealed, sealContext(id)), baseUrl: rest.baseUrl };", "lane loses fields"],
];

function fails(command) {
  try {
    execSync(command, { stdio: "ignore", timeout: 600_000 });
    return false;
  } catch {
    return true;
  }
}

const results = [];
for (const [file, from, to, label] of mutations) {
  const original = readFileSync(file, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    results.push(`SKIP (${count} matches) ${label}`);
    console.log(results.at(-1));
    continue;
  }
  writeFileSync(file, original.replace(from, to));
  let caught;
  try {
    caught = fails(ENGINE) || fails(SERVER);
  } finally {
    writeFileSync(file, original);
  }
  results.push(`${caught ? "caught  " : "SURVIVED"} ${label}`);
  console.log(results.at(-1));
}
console.log(`\n${results.filter((line) => line.startsWith("caught")).length}/${mutations.length} caught`);
