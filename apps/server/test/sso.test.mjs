// Contract: docs/contracts/m2-oidc-saml-auth.md. All IdP replies are synthetic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { SsoService } from "../dist/modules/identity/infrastructure/sso.service.js";
import { boot, sessionCookie, setUp, withTempDb } from "./helpers.mjs";

const { SignedXml } = createRequire(import.meta.resolve("@node-saml/node-saml"))("xml-crypto");

const encoder = new TextEncoder();
const reply = (status, body) => ({ status, headers: { "content-type": "application/json" },
  body: new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(JSON.stringify(body))); controller.close(); } }) });

test("OIDC start, PKCE, signed callback, one-use state and session use only fake transport", () => withTempDb(async file => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const calls = [];
  let nonce = "", tokenNonce = () => nonce, tokenIssuer = "https://idp.example", tokenAudience = "test-client";
  const transport = { async send(request, context) {
    calls.push(request);
    assert.equal(request.timeoutMs, 8000);
    assert.ok(context.signal, "upstream cancellation signal");
    if (request.url === "https://idp.example/.well-known/openid-configuration") return reply(200, {
      issuer: "https://idp.example", authorization_endpoint: "https://idp.example/authorize", token_endpoint: "https://idp.example/token", jwks_uri: "https://idp.example/jwks",
    });
    if (request.url === "https://idp.example/jwks") return reply(200, { keys: [jwk] });
    if (request.url === "https://idp.example/token") {
      const form = new URLSearchParams(request.body);
      assert.equal(form.get("grant_type"), "authorization_code");
      assert.ok(form.get("code_verifier"));
      const id_token = await new SignJWT({ nonce: tokenNonce() }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(tokenIssuer).setAudience(tokenAudience).setSubject("synthetic-user")
        .setIssuedAt().setExpirationTime("5m").sign(privateKey);
      return reply(200, { id_token });
    }
    throw new Error(`Unexpected fake IdP request: ${request.url}`);
  } };
  const { app, call } = await boot(file, { transport });
  try {
    const admin = await setUp(call);
    const saved = await call({ method: "PATCH", url: "/api/settings", cookie: admin, body: {
      authMode: "oidc", oidcIssuerUrl: "https://idp.example", oidcClientId: "test-client", oidcClientSecret: "synthetic-secret", ssoPublicOrigin: "https://aigate.example",
    } });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(saved.body.includes("synthetic-secret"), false);
    const start = await call({ url: "/api/auth/oidc/start" });
    assert.equal(start.statusCode, 302, start.body);
    const authorize = new URL(start.headers.location);
    assert.equal(authorize.origin, "https://idp.example");
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.ok(authorize.searchParams.get("code_challenge"));
    assert.ok(authorize.searchParams.get("state"));
    nonce = authorize.searchParams.get("nonce");
    assert.ok(nonce);
    const stateCookie = start.headers["set-cookie"].split(";")[0];
    assert.match(stateCookie, /^aigate_oidc=/);
    assert.equal((await call({ url: `/api/auth/oidc/callback?code=synthetic-code&state=wrong`, cookie: stateCookie })).headers.location, "/login?error=OIDC_LOGIN_FAILED");
    const callback = await call({ url: `/api/auth/oidc/callback?code=synthetic-code&state=${encodeURIComponent(authorize.searchParams.get("state"))}`, cookie: stateCookie });
    assert.equal(callback.statusCode, 302, callback.body);
    assert.equal(callback.headers.location, "/");
    const cookies = callback.headers["set-cookie"];
    assert.ok(Array.isArray(cookies));
    assert.match(cookies[0], /^aigate_oidc=;.*Max-Age=0/);
    assert.match(cookies[1], /^aigate_session=/);
    assert.match(cookies[1], /; Secure/);
    const session = sessionCookie({ headers: { "set-cookie": cookies[1] } });
    assert.equal((await call({ url: "/api/auth/status", cookie: session })).json().authenticated, true);
    const replay = await call({ url: `/api/auth/oidc/callback?code=synthetic-code&state=${encodeURIComponent(authorize.searchParams.get("state"))}`, cookie: stateCookie });
    assert.equal(replay.headers.location, "/login?error=OIDC_LOGIN_FAILED");
    assert.equal(calls.filter(row => row.url.endsWith("/token")).length, 1);

    const second = await call({ url: "/api/auth/oidc/start" });
    const secondUrl = new URL(second.headers.location);
    tokenNonce = () => "wrong-nonce";
    const invalid = await call({ url: `/api/auth/oidc/callback?code=synthetic-code&state=${encodeURIComponent(secondUrl.searchParams.get("state"))}`, cookie: second.headers["set-cookie"].split(";")[0] });
    assert.equal(invalid.headers.location, "/login?error=OIDC_LOGIN_FAILED");
    assert.equal([invalid.headers["set-cookie"]].flat().some(item => item.startsWith("aigate_session=")), false);

    tokenNonce = () => nonce;
    for (const claim of ["issuer", "audience"]) {
      const attempt = await call({ url: "/api/auth/oidc/start" });
      const attemptUrl = new URL(attempt.headers.location);
      nonce = attemptUrl.searchParams.get("nonce");
      if (claim === "issuer") tokenIssuer = "https://other-idp.example";
      else tokenAudience = "other-client";
      const refused = await call({ url: `/api/auth/oidc/callback?code=synthetic-code&state=${encodeURIComponent(attemptUrl.searchParams.get("state"))}`, cookie: attempt.headers["set-cookie"].split(";")[0] });
      assert.equal(refused.headers.location, "/login?error=OIDC_LOGIN_FAILED");
      assert.equal([refused.headers["set-cookie"]].flat().some(item => item.startsWith("aigate_session=")), false);
      tokenIssuer = "https://idp.example";
      tokenAudience = "test-client";
    }
  } finally { await app.close(); }
}));

test("OIDC test reports rejected and accepted clients, bounds responses, and requires a session", () => withTempDb(async file => {
  let probeError = "invalid_client";
  const calls = [];
  const transport = { async send(request) {
    calls.push(request);
    if (request.url.endsWith("/.well-known/openid-configuration")) return probeError === "oversize"
      ? reply(200, { padding: "x".repeat(70 * 1024) })
      : reply(200, { issuer: "https://idp.example", authorization_endpoint: "https://idp.example/authorize", token_endpoint: "https://idp.example/token", jwks_uri: "https://idp.example/jwks" });
    if (request.url === "https://idp.example/token") return reply(400, { error: probeError });
    throw new Error(`Unexpected fake IdP request: ${request.url}`);
  } };
  const { app, call } = await boot(file, { transport });
  try {
    const body = { issuerUrl: "https://idp.example", clientId: "test-client", clientSecret: "synthetic-secret" };
    assert.equal((await call({ method: "POST", url: "/api/auth/oidc/test", body })).statusCode, 401);
    const admin = await setUp(call);
    const testOidc = () => call({ method: "POST", url: "/api/auth/oidc/test", cookie: admin, body });
    const rejected = await testOidc();
    assert.equal(rejected.statusCode, 200, rejected.body);
    assert.deepEqual([rejected.json().ok, rejected.json().clientSecretValid], [false, false]);
    probeError = "invalid_grant";
    const accepted = await testOidc();
    assert.deepEqual([accepted.json().ok, accepted.json().clientSecretValid], [true, true]);
    probeError = "oversize";
    const oversized = await testOidc();
    assert.equal(oversized.statusCode, 503);
    assert.equal(oversized.json().code, "OIDC_TEST_FAILED");
    assert.equal(calls.filter(row => row.url === "https://idp.example/token").length, 2);
    const importResult = await call({ method: "POST", url: "/api/settings/import/preview", cookie: admin, body: { format: "aigate-settings", version: 1, settings: { ssoPublicOrigin: "https://aigate.example" } } });
    assert.equal(importResult.statusCode, 400, importResult.body);
    for (const invalid of [
      { oidcIssuerUrl: "http://idp.example" }, { oidcIssuerUrl: "https://idp.example/?query=1" },
      { samlEntryPoint: "https://user:pass@idp.example/sso" }, { ssoPublicOrigin: "https://aigate.example/path" },
    ]) {
      const response = await call({ method: "PATCH", url: "/api/settings", cookie: admin, body: invalid });
      assert.deepEqual([response.statusCode, response.json().code], [400, "INVALID_REQUEST"]);
    }
  } finally { await app.close(); }
}));

test("SAML ACS alone accepts bounded form input; absent state, oversized body and other form routes fail", () => withTempDb(async file => {
  const { app, call } = await boot(file);
  try {
    const fastify = app.getHttpAdapter().getInstance();
    const acs = await fastify.inject({ method: "POST", url: "/api/auth/saml/acs", payload: "RelayState=missing&SAMLResponse=bad", headers: { "content-type": "application/x-www-form-urlencoded" } });
    assert.equal(acs.statusCode, 302, acs.body);
    assert.equal(acs.headers.location, "/login?error=SAML_LOGIN_FAILED");
    assert.match(acs.headers["set-cookie"], /^aigate_saml=;.*Max-Age=0/);
    const oversized = await fastify.inject({ method: "POST", url: "/api/auth/saml/acs", payload: `SAMLResponse=${"A".repeat(256 * 1024)}`, headers: { "content-type": "application/x-www-form-urlencoded" } });
    assert.equal(oversized.statusCode, 413);
    const other = await fastify.inject({ method: "PATCH", url: "/api/settings", payload: "requireLogin=false", headers: { "content-type": "application/x-www-form-urlencoded" } });
    assert.equal(other.statusCode, 415);
    assert.equal((await call({ url: "/api/auth/saml/metadata" })).statusCode, 400);
  } finally { await app.close(); }
}));

test("SAML signed assertion creates a session once; replay and altered signature fail", () => withTempDb(async file => {
  const cert = await readFile(new URL("./fixtures/sso-idp-test.crt", import.meta.url), "utf8");
  const privateKey = await readFile(new URL("./fixtures/sso-idp-test.key", import.meta.url), "utf8");
  const { app, call } = await boot(file);
  try {
    const admin = await setUp(call);
    const saved = await call({ method: "PATCH", url: "/api/settings", cookie: admin, body: {
      authMode: "saml", samlEntryPoint: "https://idp.example/sso", samlIssuer: "urn:test-sp", samlCert: cert,
      ssoPublicOrigin: "https://aigate.example",
    } });
    assert.equal(saved.statusCode, 200, saved.body);
    const localTest = await call({ method: "POST", url: "/api/auth/saml/test", cookie: admin, body: {} });
    assert.equal(localTest.statusCode, 200, localTest.body);
    assert.equal(localTest.json().certValid, true);
    assert.equal(localTest.json().acsUrl, "https://aigate.example/api/auth/saml/acs");
    const metadata = await call({ url: "/api/auth/saml/metadata" });
    assert.equal(metadata.statusCode, 200, metadata.body);
    assert.match(metadata.body, /https:\/\/aigate\.example\/api\/auth\/saml\/acs/);
    const start = await call({ url: "/api/auth/saml/start" });
    assert.equal(start.statusCode, 302, start.body);
    assert.match(start.headers["set-cookie"], /SameSite=None; Secure/);
    const state = new URL(start.headers.location).searchParams.get("RelayState");
    assert.ok(state);
    const transient = start.headers["set-cookie"].split(";")[0];
    assert.equal(transient, `aigate_saml=${state}`);
    const mismatched = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/api/auth/saml/acs", headers: { "content-type": "application/x-www-form-urlencoded", cookie: transient }, payload: new URLSearchParams({ RelayState: "wrong", SAMLResponse: "bad" }).toString() });
    assert.equal(mismatched.headers.location, "/login?error=SAML_LOGIN_FAILED");
    const now = Date.now();
    const issue = new Date(now).toISOString();
    const before = new Date(now - 60_000).toISOString();
    const after = new Date(now + 300_000).toISOString();
    const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_test-assertion" Version="2.0" IssueInstant="${issue}"><saml:Issuer>https://idp.example</saml:Issuer><saml:Subject><saml:NameID>synthetic-user@example.test</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData InResponseTo="${state}" Recipient="https://aigate.example/api/auth/saml/acs" NotOnOrAfter="${after}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${before}" NotOnOrAfter="${after}"><saml:AudienceRestriction><saml:Audience>urn:test-sp</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="${issue}" SessionIndex="_synthetic-session"/><saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>synthetic-email@example.test</saml:AttributeValue></saml:Attribute><saml:Attribute Name="displayName"><saml:AttributeValue>Synthetic User</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`;
    const signer = new SignedXml({ privateKey, publicCert: cert, signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" });
    signer.addReference({ xpath: "/*[local-name()='Assertion']", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"], digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256" });
    signer.computeSignature(assertion, { prefix: "ds", location: { reference: "/*[local-name()='Assertion']/*[local-name()='Issuer']", action: "after" } });
    const signed = signer.getSignedXml();
    const response = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_synthetic-response" Version="2.0" IssueInstant="${issue}" Destination="https://aigate.example/api/auth/saml/acs" InResponseTo="${state}"><saml:Issuer>https://idp.example</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${signed}</samlp:Response>`;
    const post = (xml) => app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/api/auth/saml/acs", headers: { "content-type": "application/x-www-form-urlencoded", cookie: transient }, payload: new URLSearchParams({ RelayState: state, SAMLResponse: Buffer.from(xml).toString("base64") }).toString() });
    const service = app.get(SsoService);
    const originalCallback = service.samlCallback.bind(service);
    let authenticatedIdentity;
    service.samlCallback = async (...args) => { authenticatedIdentity = await originalCallback(...args); return authenticatedIdentity; };
    const ok = await post(response);
    assert.equal(ok.statusCode, 302, ok.body);
    assert.equal(ok.headers.location, "/");
    assert.deepEqual(authenticatedIdentity, { subject: "synthetic-user@example.test", email: "synthetic-email@example.test", name: "Synthetic User" });
    const session = [ok.headers["set-cookie"]].flat().find(item => item.startsWith("aigate_session="))?.split(";")[0];
    assert.ok(session);
    assert.match([ok.headers["set-cookie"]].flat().find(item => item.startsWith("aigate_session=")), /; Secure/);
    assert.equal((await call({ url: "/api/auth/status", cookie: session })).json().authenticated, true);
    assert.equal((await post(response)).headers.location, "/login?error=SAML_LOGIN_FAILED");

    const next = await call({ url: "/api/auth/saml/start" });
    const nextState = new URL(next.headers.location).searchParams.get("RelayState");
    const altered = response.replaceAll(state, nextState).replace("synthetic-user@example.test", "attacker@example.test");
    const invalid = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/api/auth/saml/acs", headers: { "content-type": "application/x-www-form-urlencoded", cookie: next.headers["set-cookie"].split(";")[0] }, payload: new URLSearchParams({ RelayState: nextState, SAMLResponse: Buffer.from(altered).toString("base64") }).toString() });
    assert.equal(invalid.headers.location, "/login?error=SAML_LOGIN_FAILED");

    const expiredStart = await call({ url: "/api/auth/saml/start" });
    const expiredState = new URL(expiredStart.headers.location).searchParams.get("RelayState");
    const pending = app.get(SsoService).pendingSaml.get(expiredState);
    assert.ok(pending);
    pending.createdAt = Date.now() - 11 * 60_000;
    const expired = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/api/auth/saml/acs", headers: { "content-type": "application/x-www-form-urlencoded", cookie: expiredStart.headers["set-cookie"].split(";")[0] }, payload: new URLSearchParams({ RelayState: expiredState, SAMLResponse: "bad" }).toString() });
    assert.equal(expired.headers.location, "/login?error=SAML_LOGIN_FAILED");
    assert.equal(app.get(SsoService).pendingSaml.has(expiredState), false);
  } finally { await app.close(); }
}));
