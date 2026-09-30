import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PxpipeService } from "../dist/modules/routing/infrastructure/pxpipe.service.js";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, json, ready } from "./lane-helpers.mjs";

const root = await mkdtemp(join(tmpdir(), "aigate-pxpipe-"));
try {
  const packageDir = join(root, "pxpipe", "node_modules", "pxpipe-proxy");
  await mkdir(packageDir, { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ version: "test", exports: { "./transform": { import: "./library.mjs" } } }));
  await writeFile(join(packageDir, "library.mjs"), [
    "export async function transformAnthropicMessages({ body }) {",
    "  const text = Buffer.from(body).toString(\"utf8\");",
    "  if (text.includes(\"eligible\")) return { body: Buffer.from(text.replace(\"eligible\", \"transformed\")), applied: true };",
    "  return { body, applied: false };",
    "}",
  ].join("\n"));
  const service = new PxpipeService(root);
  assert.deepEqual(await service.status(), { installed: true, loaded: true, installing: false, version: "test" });
  assert.equal(await service.apply("eligible", "claude-model", 9, 100), "eligible", "minimum size leaves short prompts unchanged");
  assert.equal(await service.apply("eligible request", "claude-model", 9, 100), "transformed request");
  assert.equal(await service.apply("ordinary request", "claude-model", 9, 100), "ordinary request", "no-op transforms preserve input");
} finally {
  await rm(root, { recursive: true, force: true });
}

test("PXPIPE rewrites a large Anthropic Messages request in-process; opt-out bypasses it", () =>
  withTempDb(async (file) => {
    const packageDir = join(dirname(file), "pxpipe", "node_modules", "pxpipe-proxy");
    await mkdir(packageDir, { recursive: true });
    await writeFile(join(packageDir, "package.json"), JSON.stringify({ version: "test", exports: { "./transform": { import: "./library.mjs" } } }));
    await writeFile(join(packageDir, "library.mjs"), [
      "export async function transformAnthropicMessages({ body }) {",
      "  const text = Buffer.from(body).toString(\"utf8\");",
      "  return { body: Buffer.from(text.replace(\"replace-me\", \"transformed\")), applied: text.includes(\"replace-me\") };",
      "}",
    ].join("\n"));
    const upstream = fakeUpstream(json(200, {
      id: "msg_px", type: "message", model: "claude-sonnet-4-20250514", stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 },
    }), json(200, {
      id: "msg_px", type: "message", model: "claude-sonnet-4-20250514", stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 },
    }));
    const { app, call, dash, key } = await ready(file, upstream);
    await dash({ method: "POST", url: "/api/connections", body: { provider: "anthropic", apiKey: "sk-ant-pxpipe-123456" } });
    await dash({ method: "PATCH", url: "/api/settings", body: { tokenSaverEnabled: true, pxpipeEnabled: true, pxpipeMinChars: 1000 } });
    const request = {
      model: "anthropic/claude-sonnet-4-20250514", max_tokens: 20, stream: false,
      messages: [{ role: "user", content: "replace-me " + "long context ".repeat(100) }],
    };
    const first = await call({ method: "POST", url: "/v1/messages", body: request, headers: { "x-api-key": key, accept: "application/json" } });
    assert.equal(first.statusCode, 200);
    assert.match(upstream.calls[0].request.body, /transformed/, "the serialized provider body was changed before transport send");
    const second = await call({ method: "POST", url: "/v1/messages", body: request, headers: { "x-api-key": key, "x-aigate-token-saver": "off", accept: "application/json" } });
    assert.equal(second.statusCode, 200);
    assert.match(upstream.calls[1].request.body, /replace-me/, "the request opt-out leaves the serialized body untouched");
    await app.close();
  }));
