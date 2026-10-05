import { Controller, Delete, Get, HttpCode, Res, ServiceUnavailableException } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ConsoleLogService } from "./console-log.service.js";

const MAX_STREAMS = 8;
const MAX_STREAM_BUFFER = 64 * 1024;
const PING_MS = 25_000;

@Controller("api/tooling/logs")
export class ToolingController {
  private streams = 0;
  constructor(private readonly logs: ConsoleLogService) {}

  @Get()
  list() { return this.logs.list(); }

  @Delete()
  @HttpCode(204)
  clear(): void { this.logs.clear(); }

  @Get("stream")
  stream(@Res() reply: FastifyReply): void {
    if (this.streams >= MAX_STREAMS) throw new ServiceUnavailableException({ code: "LOG_STREAM_BUSY", message: `All ${MAX_STREAMS} live log views are occupied.` });
    this.streams += 1;
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" });
    const write = (line: string) => {
      if (raw.writableLength > MAX_STREAM_BUFFER) raw.destroy();
      else raw.write(line);
    };
    const off = this.logs.subscribe((event) => write(event ? `data: ${JSON.stringify(event)}\n\n` : "event: clear\ndata: {}\n\n"));
    const ping = setInterval(() => write(": ping\n\n"), PING_MS);
    raw.once("close", () => { this.streams -= 1; off(); clearInterval(ping); });
  }
}
