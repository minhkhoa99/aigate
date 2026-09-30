import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query } from "@nestjs/common";
import { addDays, dayKey } from "../domain/usage.js";
import { DisplayNames } from "./display-names.js";
import { UsageRecorder } from "./usage-recorder.js";
import { RequestsRepository, type RequestFilter } from "./requests.repo.js";

// docs/contracts/usage.md "Requests". Protected by the global dashboard guard.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });

type Query = { cursor?: string; limit?: string; status?: string; provider?: string; model?: string; endpoint?: string; fallback?: string; from?: string; to?: string };

// The cursor is the last row's (at, id), opaque to the client.
const encodeCursor = (at: number, id: string) => Buffer.from(JSON.stringify([at, id])).toString("base64url");
function decodeCursor(cursor: string): { at: number; id: string } {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(value) && value.length === 2 && Number.isSafeInteger(value[0]) && typeof value[1] === "string") return { at: value[0], id: value[1] };
  } catch { /* falls through */ }
  throw invalid("cursor is not a value this API returned. Start again without it.");
}
const text = (value: string | undefined, name: string): string | undefined => {
  if (value === undefined || value === "") return undefined;
  if (value.length > 200) throw invalid(`${name} must be at most 200 characters.`);
  return value;
};
const instant = (value: string | undefined, name: string): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const ms = Number(value);
  if (!Number.isSafeInteger(ms) || ms < 0) throw invalid(`${name} must be a time in epoch milliseconds.`);
  return ms;
};

@Controller("api/requests")
export class RequestsController {
  constructor(private readonly requests: RequestsRepository, private readonly displayNames: DisplayNames, private readonly recorder: UsageRecorder) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Query() query: Query) {
    const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw invalid(`limit must be an integer from 1 to ${MAX_LIMIT}.`);
    if (query.status !== undefined && query.status !== "" && query.status !== "error") throw invalid("status can only be error (errors and aborted requests).");
    const filter: RequestFilter = {
      errorsOnly: query.status === "error", provider: text(query.provider, "provider"), model: text(query.model, "model"), endpoint: text(query.endpoint, "endpoint"),
      fallback: query.fallback === "1" || query.fallback === "true", fromMs: instant(query.from, "from"), toMs: instant(query.to, "to"),
      before: query.cursor ? decodeCursor(query.cursor) : undefined,
    };
    const rows = await this.requests.list(filter, limit);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const names = await this.displayNames.load();
    return {
      items: page.map((row) => ({
        ...row, at: row.at.getTime(), providerName: names.provider(row.finalProvider), connectionName: names.connection(row.finalConnectionId), keyName: names.key(row.apiKeyId),
      })),
      nextCursor: rows.length > limit && last ? encodeCursor(last.at.getTime(), last.id) : null,
    };
  }

  @Get("filters")
  @Header("Cache-Control", "no-store")
  async filters() {
    const { timezone, retentionDays } = this.recorder.config;
    const { models, endpoints } = await this.requests.filters(addDays(dayKey(Date.now(), timezone), -retentionDays));
    const names = await this.displayNames.load();
    const providers = [...new Set(models.map((row) => row.provider))].map((id) => ({ id, name: names.provider(id) }));
    return { providers, models, endpoints };
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async detail(@Param("id") id: string) {
    const found = id.length <= 100 ? await this.requests.detail(id) : undefined;
    if (!found) throw new NotFoundException({ code: "NOT_FOUND", message: "No request with this id: it was never recorded or is past the usage retention." });
    const names = await this.displayNames.load();
    const { request, attempts } = found;
    return {
      request: { ...request, at: request.at.getTime(), providerName: names.provider(request.finalProvider), connectionName: names.connection(request.finalConnectionId), keyName: names.key(request.apiKeyId) },
      attempts: attempts.map((attempt) => ({ ...attempt, at: attempt.at.getTime(), providerName: names.provider(attempt.provider), connectionName: names.connection(attempt.connectionId) })),
    };
  }
}
