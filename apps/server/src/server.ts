import "reflect-metadata";
import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

// Paths the SPA fallback must never answer: an unknown API path stays a JSON 404.
const API_PREFIXES = ["/api", "/v1", "/v1beta", "/codex", "/responses"];

function isSpaRoute(url: string): boolean {
  const path = url.split("?", 1)[0];
  if (API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  return !/\.[a-z0-9]+$/i.test(path);
}

export async function createServer(webDist?: string): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableShutdownHooks();

  if (webDist && existsSync(join(webDist, "index.html"))) {
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.register(fastifyStatic, { root: webDist, wildcard: false });
    fastify.get("/*", (request, reply) => (isSpaRoute(request.url) ? reply.sendFile("index.html") : reply.callNotFound()));
  }
  return app;
}
