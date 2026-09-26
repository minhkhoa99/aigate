// Contract: docs/contracts/provider-vertex.md — a Vertex connection with a service-account JSON: save, test, and /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, json, ready } from "./lane-helpers.mjs";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const EMAIL = "gateway@lane-proj.iam.gserviceaccount.com";
// Pretty-printed, as Google downloads it: spaces and line breaks are part of the credential.
const SERVICE_ACCOUNT = JSON.stringify({ type: "service_account", project_id: "lane-proj", private_key_id: "k1", private_key: privateKey, client_email: EMAIL }, null, 2);
const token = (value) => json(200, { access_token: value, expires_in: 3599 });

test("a Vertex service-account JSON is saved by its account, tested by minting a token, and serves /v1", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      token("lane-token"),
      json(200, { responseId: "v1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text: "Hi from Vertex" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } }),
    );
    const { app, dash, chat } = await ready(file, upstream);
    const wrongProvider = await dash({ method: "POST", url: "/api/connections", body: { provider: "groq", apiKey: SERVICE_ACCOUNT } });
    assert.deepEqual([wrongProvider.statusCode, wrongProvider.json().message], [400, "apiKey must be 8-4096 printable characters without spaces"]);
    const incomplete = await dash({ method: "POST", url: "/api/connections", body: { provider: "vertex", apiKey: JSON.stringify({ type: "service_account", client_email: EMAIL }) } });
    assert.deepEqual([incomplete.statusCode, incomplete.json().message], [400, "apiKey is not a usable Google Cloud credential: a service_account JSON needs client_email, private_key, and project_id"]);
    const created = await dash({ method: "POST", url: "/api/connections", body: { provider: "vertex", apiKey: SERVICE_ACCOUNT } });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().keyHint, EMAIL, "named by its account, never by a piece of the key");
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.json().id}/test` })).json();
    assert.equal(tested.testStatus, "active");
    assert.equal(upstream.calls[0].request.url, "https://oauth2.googleapis.com/token");
    const res = await chat({ model: "vertex/gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().choices[0].message.content, "Hi from Vertex");
    const sent = upstream.calls[1].request;
    assert.equal(sent.url, "https://aiplatform.googleapis.com/v1/projects/lane-proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent");
    assert.equal(sent.headers.authorization, "Bearer lane-token", "the token minted by the test is reused");
    await app.close();
  }));
