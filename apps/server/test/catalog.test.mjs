// Contract: docs/contracts/catalog-providers.md — GET /api/providers and /api/providers/:id over Fastify inject.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "@aigate/engine";
import { boot, setUp, withTempDb } from "./helpers.mjs";

test("the provider catalog lists every provider with its connectable status, behind the session", () =>
  withTempDb(async (file) => {
    const { app, call } = await boot(file);
    const cookie = await setUp(call);
    assert.equal((await call({ url: "/api/providers" })).statusCode, 401);
    const res = await call({ url: "/api/providers", cookie });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "no-store");
    const list = res.json();
    assert.equal(list.length, CATALOG.length);
    const openai = list.find((p) => p.id === "openai");
    assert.deepEqual({ ...openai, modelCount: openai.modelCount > 0 }, {
      id: "openai", name: "OpenAI", aliases: openai.aliases, category: openai.category, protocol: "openai-compatible", authKinds: openai.authKinds, hidden: false,
      connectable: true, reason: null, modelCount: true,
    });
    const claude = list.find((p) => p.id === "claude");
    assert.deepEqual([claude.connectable, claude.reason], [false, "Needs OAuth sign-in (SP16)"]);
    assert.ok(list.every((p) => p.connectable === (p.reason === null)), "a reason exactly when not connectable");
    assert.equal(list.filter((p) => p.connectable).length, 49);
    await app.close();
  }));

test("a provider detail carries its models, with limits the runtime trusts", () =>
  withTempDb(async (file) => {
    const { app, call } = await boot(file);
    const cookie = await setUp(call);
    const res = await call({ url: "/api/providers/openai", cookie });
    assert.equal(res.statusCode, 200);
    const detail = res.json();
    assert.equal(detail.chatUrl, "https://api.openai.com/v1/chat/completions");
    const model = detail.models.find((m) => m.id === "gpt-4.1");
    assert.deepEqual([model.kind, model.contextWindow], ["chat", 1000000]);
    const tencent = (await call({ url: "/api/providers/tencent", cookie })).json();
    assert.ok(tencent.models.every((m) => m.maxOutputTokens === null || m.contextWindow === null || m.maxOutputTokens <= m.contextWindow));
    const blocked = (await call({ url: "/api/providers/claude", cookie })).json();
    assert.ok(blocked.models.length > 0, "a provider that cannot be connected still shows its models");
    assert.ok(blocked.models.every((m) => m.kind !== "llm"), "one kind vocabulary for the UI");
    const missing = await call({ url: "/api/providers/no-such-provider", cookie });
    assert.deepEqual([missing.statusCode, missing.json().code], [404, "NOT_FOUND"]);
    assert.match(missing.json().message, /no-such-provider/);
    await app.close();
  }));
