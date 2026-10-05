import { Controller, Get, Header, Inject, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { DAILY_RETENTION_DAYS, UsageRecorder } from "../../usage/infrastructure/usage-recorder.js";

export const RUNTIME_CONFIG = Symbol("RUNTIME_CONFIG");
export interface RuntimeConfig { readonly dataDir: string; readonly streamIdleTimeoutMs: number }

// Bootstrap-owned values, never the environment or a credential dump (docs/contracts/settings.md SP27).
@Controller("api/settings")
export class RuntimeController {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    private readonly usage: UsageRecorder,
  ) {}

  @Get("runtime")
  @Header("Cache-Control", "no-store")
  @Header("Content-Disposition", 'attachment; filename="aigate-runtime.json"')
  get(@Req() request: FastifyRequest) {
    const address = request.server.server.address();
    return {
      at: Date.now(), bindAddress: address && typeof address !== "string" ? address.address : null,
      port: address && typeof address !== "string" ? address.port : null,
      dataDir: this.config.dataDir, nodeVersion: process.version, databaseDriver: this.database.driver,
      uptimeSeconds: Math.floor(process.uptime()), streamIdleTimeoutMs: this.config.streamIdleTimeoutMs,
      usageTimezone: this.usage.config.timezone, usageRetentionDays: this.usage.config.retentionDays,
      dailyRetentionDays: DAILY_RETENTION_DAYS, writer: this.usage.writer(),
    };
  }
}
