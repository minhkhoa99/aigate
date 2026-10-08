import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { reasonMessageKey, simulationChildren, validateSimulationResult } from "./simulation-result.ts";

const node = { id: 0, parentId: null, kind: "request", status: "candidate", reason: "model-resolved", model: "raw-model/x <tag>" };
const result = { observedAt: "2026-10-08T00:00:00.000Z", outcome: "candidate", requiredCapabilities: [], nodes: [node], warnings: [], truncated: false };
test("literal/unknown codes are safe and malformed trees cannot recurse", () => {
  assert.equal(reasonMessageKey("account-selected"), "simulator.reasonAccountSelected");
  assert.equal(reasonMessageKey("__proto__"), "simulator.reasonUnknown");
  assert.equal(simulationChildren([node]).get(null)[0].model, "raw-model/x <tag>");
  for (const nodes of [[{ ...node, parentId: 0 }], [node, { ...node, id: 1, parentId: 7 }], [node, node], [{ ...node, model: {} }]])
    assert.throws(() => simulationChildren(nodes));
  assert.throws(() => validateSimulationResult({ ...result, warnings: [{}] }));
  assert.throws(() => validateSimulationResult({ ...result, observedAt: "invalid" }));
});

test("actual result rendering localizes owned copy but not identifiers or unknown codes", async () => {
  const { createServer } = await import("vite");
  const { createElement: h } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const server = await createServer({ root: fileURLToPath(new URL("../../../", import.meta.url)), logLevel: "error", configFile: false,
    server: { middlewareMode: true, watch: null, hmr: false }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: [] } });
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    const { LocaleProvider } = await server.ssrLoadModule("/src/shared/locale.tsx");
    const { SimulationResultView } = await server.ssrLoadModule("/src/features/gateway/routing-simulator.tsx");
    for (const language of ["en", "vi"]) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => language } });
      const html = renderToStaticMarkup(h(LocaleProvider, null, h(SimulationResultView, { result: { ...result, nodes: [{ ...node, reason: "unknown-reason" }] }, stale: true })));
      assert.ok(html.includes("raw-model/x &lt;tag&gt;"));
      assert.ok(html.includes("unknown-reason"));
      assert.ok(html.includes(language === "vi" ? "Kết quả đã cũ" : "Result is stale"));
      assert.equal(html.includes("<tag>"), false);
    }
  } finally {
    if (old) Object.defineProperty(globalThis, "localStorage", old); else delete globalThis.localStorage;
    await server.close();
  }
});
