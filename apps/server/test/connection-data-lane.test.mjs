// Contract: docs/contracts/provider-connection-data.md, connections.md — azure and cloudflare-ai connection fields: save, test, and /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, json, ready } from "./lane-helpers.mjs";

const KEY = "azure-lane-key-5678";
const reply = { id: "c1", model: "gpt-4o", choices: [{ message: { content: "from Azure" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2 } };

test("azure and cloudflare-ai take their connection fields, require what they need, and reach the filled URL", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(404, { error: { code: "DeploymentNotFound", message: "no deployment" } }), json(200, reply));
    const { app, dash, chat } = await ready(file, upstream);
    const post = (body) => dash({ method: "POST", url: "/api/connections", body });
    const refused = async (body, message) => {
      const res = await post(body);
      assert.deepEqual([res.statusCode, res.json().message], [400, message]);
    };
    await refused({ provider: "azure", apiKey: KEY }, "baseUrl is required for a Azure OpenAI connection");
    await refused({ provider: "azure", apiKey: KEY, baseUrl: "https://res.openai.azure.com", deployment: "a/b" }, "deployment must be 1-64 letters, digits, dots, dashes, or underscores");
    await refused({ provider: "azure", apiKey: KEY, baseUrl: "https://res.openai.azure.com", accountId: "abc" }, "accountId cannot be set on a Azure OpenAI connection");
    await refused({ provider: "cloudflare-ai", apiKey: KEY }, "accountId is required for a Cloudflare connection");
    await refused({ provider: "cloudflare-ai", apiKey: KEY, accountId: "../x" }, "accountId must be 1-64 letters, digits, or dashes");
    await refused({ provider: "groq", apiKey: KEY, deployment: "d" }, "deployment cannot be set on a Groq connection");
    const created = await post({ provider: "azure", apiKey: KEY, baseUrl: "https://res.openai.azure.com/", deployment: "prod", apiVersion: "2025-01-01", organization: "org-7" });
    assert.equal(created.statusCode, 201);
    assert.deepEqual([created.json().baseUrl, created.json().deployment, created.json().apiVersion, created.json().organization, created.json().accountId],
      ["https://res.openai.azure.com/", "prod", "2025-01-01", "org-7", null], "stored as typed; the trailing / is dropped when the URL is built");
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.json().id}/test` })).json();
    assert.equal(tested.testStatus, "active", "only 401/403 fail the Azure test, as in 9router");
    assert.equal(upstream.calls[0].request.url, "https://res.openai.azure.com/openai/deployments/prod/chat/completions?api-version=2025-01-01");
    const res = await chat({ model: "azure/gpt-4o", messages: [{ role: "user", content: "hi" }] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().choices[0].message.content, "from Azure");
    const sent = upstream.calls[1].request;
    assert.equal(sent.url, "https://res.openai.azure.com/openai/deployments/prod/chat/completions?api-version=2025-01-01", "the stored deployment wins over the model");
    assert.deepEqual([sent.headers["api-key"], sent.headers["openai-organization"]], [KEY, "org-7"]);
    const cleared = await dash({ method: "PATCH", url: `/api/connections/${created.json().id}`, body: { baseUrl: "" } });
    assert.deepEqual([cleared.statusCode, cleared.json().message], [400, "baseUrl is required for a Azure OpenAI connection"]);
    const edited = await dash({ method: "PATCH", url: `/api/connections/${created.json().id}`, body: { deployment: "", organization: null } });
    assert.deepEqual([edited.json().deployment, edited.json().organization], [null, null], "optional fields can be cleared");
    const cf = await post({ provider: "cloudflare-ai", apiKey: KEY, accountId: " 0123abcd " });
    assert.equal(cf.json().accountId, "0123abcd", "trimmed");
    await app.close();
  }));
