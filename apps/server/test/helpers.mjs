// Shared boot and sign-in helpers for server tests (light-my-request defaults to a local client).
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../dist/server.js";

export const PASSWORD = "correct horse battery";

export async function boot(databaseFile, options = {}) {
  const app = await createServer({ databaseFile, ...options });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  const call = ({ method = "GET", url, body, cookie, remoteAddress, headers = {} }) =>
    fastify.inject({
      method, url, remoteAddress,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...headers },
    });
  return { app, call };
}

export async function withTempDb(run) {
  const dir = await mkdtemp(join(tmpdir(), "aigate-test-"));
  try {
    await run(join(dir, "aigate.db"));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function sessionCookie(res) {
  const header = res.headers["set-cookie"];
  return (Array.isArray(header) ? header[0] : header)?.split(";")[0];
}

export async function setUp(call, password = PASSWORD) {
  const res = await call({ method: "POST", url: "/api/auth/setup", body: { password } });
  if (res.statusCode !== 200) throw new Error(`setup failed: ${res.statusCode} ${res.body}`);
  return sessionCookie(res);
}
