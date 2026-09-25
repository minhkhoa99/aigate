import "reflect-metadata";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import fastifyStatic from "@fastify/static";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { openDatabase } from "@aigate/database";
import type { HttpTransportPort } from "@aigate/engine";
import { AppModule } from "./app.module.js";
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
}

export async function createServer({ databaseFile, webDist, secretKey, transport }: ServerOptions): Promise<NestFastifyApplication> {
  // Loaded before the database opens: a bad key stops startup before anything else happens.
  const cipher = new AesGcmCipher(loadSecretKey(secretKey, join(dirname(databaseFile), "secret.key")));
  const database = await openDatabase({ file: databaseFile });
  let app: NestFastifyApplication;
  try {
    // bodyParser:false drops the urlencoded parser Nest adds, so a cross-site HTML form cannot produce a
    // body these handlers accept; Fastify's own JSON parser (prototype-poisoning safe) stays.
    app = await NestFactory.create<NestFastifyApplication>(AppModule.with(database, cipher, transport), new FastifyAdapter(), { bodyParser: false });
  } catch (error) {
    await database.close();
    throw error;
  }
  app.enableShutdownHooks();

  if (webDist && existsSync(join(webDist, "index.html"))) {
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.register(fastifyStatic, { root: webDist, wildcard: false });
    fastify.get("/*", (request, reply) => (isSpaRoute(request.url) ? reply.sendFile("index.html") : reply.callNotFound()));
  }
  return app;
}
