import "reflect-metadata";
import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { openDatabase } from "@aigate/database";
import { AppModule } from "./app.module.js";

export { DATABASE } from "./database.provider.js";

// Paths the SPA fallback must never answer: an unknown API path stays a JSON 404.
const API_PREFIXES = ["/api", "/v1", "/v1beta", "/codex", "/responses"];

function isApiPath(url: string): boolean {
  const path = url.split("?", 1)[0];
  return path === "/api" || path.startsWith("/api/");
}

function isLoopback(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
}

function isSpaRoute(url: string): boolean {
  const path = url.split("?", 1)[0];
  if (API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  return !/\.[a-z0-9]+$/i.test(path);
}

export interface ServerOptions {
  databaseFile: string;
  webDist?: string;
}

export async function createServer({ databaseFile, webDist }: ServerOptions): Promise<NestFastifyApplication> {
  const database = await openDatabase({ file: databaseFile });
  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(AppModule.with(database), new FastifyAdapter());
  } catch (error) {
    await database.close();
    throw error;
  }
  app.enableShutdownHooks();

  // Until identity (SP6) adds the dashboard guard, the management API answers local clients only;
  // a PATCH could otherwise switch off requireApiKey from the network.
  app.getHttpAdapter().getInstance().addHook("onRequest", async (request, reply) => {
    if (isApiPath(request.url) && !isLoopback(request.ip)) {
      await reply.code(403).send({ code: "FORBIDDEN", message: "The management API accepts local clients only until sign-in is available" });
    }
  });

  if (webDist && existsSync(join(webDist, "index.html"))) {
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.register(fastifyStatic, { root: webDist, wildcard: false });
    fastify.get("/*", (request, reply) => (isSpaRoute(request.url) ? reply.sendFile("index.html") : reply.callNotFound()));
  }
  return app;
}
