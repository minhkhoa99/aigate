import "reflect-metadata";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import fastifyStatic from "@fastify/static";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { openDatabase } from "@aigate/database";
import type { HttpTransportPort } from "@aigate/engine";
import { AppModule } from "./app.module.js";
import { ChatLane, DEFAULT_STREAM_IDLE_TIMEOUT_MS } from "./modules/routing/infrastructure/chat-lane.js";
import { registerV1Routes } from "./modules/routing/infrastructure/v1-routes.js";
import { AesGcmCipher, loadSecretKey } from "./secret-cipher.js";

export { DATABASE } from "./database.provider.js";

// Paths the SPA fallback must never answer: an unknown API path stays a JSON 404.
const API_PREFIXES = ["/api", "/v1", "/v1beta", "/codex", "/responses"];

function isSpaRoute(url: string): boolean {
  const path = url.split("?", 1)[0];
  if (API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  return !/\.[a-z0-9]+$/i.test(path);
}

export interface ServerOptions {
  databaseFile: string;
  webDist?: string;
  // AIGATE_SECRET_KEY; when unset, secret.key next to the database is used (created once).
  secretKey?: string;
  // Tests only: replaces the direct transport, so no request leaves the machine.
  transport?: HttpTransportPort;
  // AIGATE_STREAM_IDLE_TIMEOUT_MS: longest silence between upstream stream chunks, 1000..600000.
  streamIdleTimeoutMs?: number;
}

export async function createServer({
  databaseFile, webDist, secretKey, transport, streamIdleTimeoutMs = DEFAULT_STREAM_IDLE_TIMEOUT_MS,
}: ServerOptions): Promise<NestFastifyApplication> {
  if (!Number.isInteger(streamIdleTimeoutMs) || streamIdleTimeoutMs < 1_000 || streamIdleTimeoutMs > 600_000) {
    throw new RangeError("AIGATE_STREAM_IDLE_TIMEOUT_MS must be an integer from 1000 to 600000");
  }
  // Loaded before the database opens: a bad key stops startup before anything else happens.
  const cipher = new AesGcmCipher(loadSecretKey(secretKey, join(dirname(databaseFile), "secret.key")));
  const database = await openDatabase({ file: databaseFile });
  let app: NestFastifyApplication;
  try {
    // bodyParser:false drops the urlencoded parser Nest adds, so a cross-site HTML form cannot produce a
    // body these handlers accept; Fastify's own JSON parser (prototype-poisoning safe) stays.
    app = await NestFactory.create<NestFastifyApplication>(AppModule.with(database, cipher, { streamIdleTimeoutMs }, transport), new FastifyAdapter(), { bodyParser: false });
  } catch (error) {
    await database.close();
    throw error;
  }
  app.enableShutdownHooks();
  registerV1Routes(app.getHttpAdapter().getInstance(), app.get(ChatLane));

  if (webDist && existsSync(join(webDist, "index.html"))) {
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.register(fastifyStatic, { root: webDist, wildcard: false });
    fastify.get("/*", (request, reply) => (isSpaRoute(request.url) ? reply.sendFile("index.html") : reply.callNotFound()));
  }
  return app;
}
