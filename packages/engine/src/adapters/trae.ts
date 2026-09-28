import type { CanonicalRequest, CanonicalResponse, StreamChunk, TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, parseJson, text } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";

const BASE = "https://core-normal.trae.ai/api/remote/v1";
const EVENT_LIMIT = 1024 * 1024;
const STREAM_LIMIT = 64 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const asRecord = (value: unknown) => isRecord(value) ? value : {};
const partsText = (parts: CanonicalRequest["messages"][number]["content"]): string => parts.map((part) => part.type === "text" ? part.text : "").join("");
const usageOf = (value: Record<string, unknown>): TokenUsage => ({
  inputTokens: typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0,
  outputTokens: typeof value.completion_tokens === "number" ? value.completion_tokens : 0,
});

async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<{ name: string; data: Record<string, unknown> }> {
  const reader = body.getReader(); const decoder = new TextDecoder();
  let buffer = ""; let name = ""; let data: string[] = []; let size = 0; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) { total += value.byteLength; if (total > STREAM_LIMIT) throw new EngineError("PROVIDER_UNAVAILABLE", "Trae event stream exceeded its byte limit", { provider: "trae" }); }
      const lines = (done ? decoder.decode() : decoder.decode(value, { stream: true })).split("\n");
      lines[0] = buffer + lines[0]; buffer = done ? "" : (lines.pop() ?? "");
      if (buffer.length > EVENT_LIMIT) throw new EngineError("PROVIDER_UNAVAILABLE", "Trae event exceeded its size limit", { provider: "trae" });
      for (const raw of lines) {
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        if (!line) {
          if (data.length) yield { name, data: asRecord(parseJson(data.join("\n"))) };
          name = ""; data = []; size = 0;
        } else if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          const chunk = line.slice(line.startsWith("data: ") ? 6 : 5); size += chunk.length;
          if (size > EVENT_LIMIT) throw new EngineError("PROVIDER_UNAVAILABLE", "Trae event exceeded its size limit", { provider: "trae" });
          data.push(chunk);
        }
      }
      if (done) { if (data.length) yield { name, data: asRecord(parseJson(data.join("\n"))) }; return; }
    }
  } finally { await reader.cancel().catch(() => undefined); }
}

export class TraeAdapter implements AIProviderPort {
  constructor(private readonly provider: ProviderDescriptor, private readonly transport: import("../ports.js").HttpTransportPort) {}

  private headers(credential: Credential): Record<string, string> {
    const data = credential.providerData ?? {};
    return {
      authorization: `Cloud-IDE-JWT ${credential.apiKey}`, "content-type": "application/json", "x-trae-client-type": "web",
      "x-preferenced-language": data.appLanguage || "en", "x-user-region": data.userRegion || "US", referer: "https://solo.trae.ai/", "user-agent": USER_AGENT,
    };
  }

  private mode(model: string): { mode: "code" | "work"; strategy: "auto" | "manual"; modelName: string } {
    const value = model.trim().toLowerCase();
    if (["work", "auto-work", "solo-work"].includes(value)) return { mode: "work", strategy: "auto", modelName: "" };
    return { mode: "code", strategy: !value || value === "auto" ? "auto" : "manual", modelName: !value || value === "auto" ? "" : model };
  }

  private query(request: CanonicalRequest): string {
    const messages = [...(request.system ? [{ role: "system" as const, content: request.system }] : []), ...request.messages];
    const text = messages.map((message) => {
      const content = partsText(message.content);
      return message.role === "system" ? `[System]\n${content}` : message.role === "assistant" ? `[Assistant]\n${content}` : content;
    }).filter(Boolean).join("\n\n");
    return JSON.stringify([{ type: "text", data: { content: text } }]);
  }

  private commonParams(data: Readonly<Record<string, string>>, mode: string, sessionId?: string): string {
    return JSON.stringify({ language: "en-us", app_language: data.appLanguage || "en", quality: "stable", app_version: data.appVersion || "3.5.54", web_id: data.webId || "", user_identity: data.userIdentity || "Free", is_freshman: "0", biz_user_id: data.bizUserId || "", user_unique_id: data.userUniqueId || "", scope: data.scope || "marscode-us", tenant: data.tenant || "marscode", region: data.region || "US-East", aiRegion: data.aiRegion || data.region || "US-East", is_privacy_mode: 0, privacy_mode: "off", solo_chat_mode: mode, ...(sessionId ? { biz_session_id: sessionId } : {}) });
  }

  private async session(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<{ sessionId: string; messageId: string; headers: Record<string, string> }> {
    const mode = this.mode(request.model); const headers = this.headers(credential);
    const initial = {
      chat_session_id: "", content: [], query: this.query(request), model_name: mode.modelName, agent_type: "solo_agent_remote",
      model_selection_strategy: mode.strategy, common_params: this.commonParams(credential.providerData ?? {}, mode.mode, credential.sessionId),
    };
    const response = await this.transport.send({ method: "POST", url: `${BASE}/chat_sessions`, headers, body: JSON.stringify({ mode: mode.mode, environment_id: "default", initial_message: initial, env: "remote", auto_create_project: false, origin: "web" }), timeoutMs: 30_000 }, ctx);
    const raw = await readBoundedText(response.body, 1024 * 1024);
    const root = asRecord(parseJson(raw)); const result = asRecord(root.data);
    const sessionId = text(result.chat_session_id); const messageId = text(result.message_id);
    if (response.status < 200 || response.status >= 300 || root.code !== 0 || !sessionId || !messageId) throw new EngineError(response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", `Trae session creation failed (${response.status})`, { provider: "trae", status: response.status });
    return { sessionId, messageId, headers };
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncIterable<StreamChunk> {
    if (!credential.apiKey) throw new EngineError("AUTH_ERROR", "Trae access token is missing", { provider: "trae" });
    const session = await this.session(request, credential, ctx); const id = crypto.randomUUID();
    const url = `${BASE}/chat_sessions/${encodeURIComponent(session.sessionId)}/events?reply_to_message_id=${encodeURIComponent(session.messageId)}`;
    const response = await this.transport.send({ method: "GET", url, headers: { ...session.headers, accept: "text/event-stream" }, timeoutMs: 300_000 }, ctx);
    if (response.status < 200 || response.status >= 300 || !response.body) throw new EngineError(response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", `Trae event stream failed (${response.status})`, { provider: "trae", status: response.status });
    yield { type: "start", id, model: request.model };
    const order: string[] = []; const thoughts = new Map<string, string>(); let emitted = 0; let usage: TokenUsage | undefined;
    for await (const event of events(response.body)) {
      if (event.name === "error") throw new EngineError("PROVIDER_UNAVAILABLE", `Trae ${text(event.data.code) ?? "error"}: ${text(event.data.message) ?? "upstream error"}`, { provider: "trae", partial: emitted > 0 });
      if (event.name === "token_usage") usage = usageOf(event.data);
      if (event.name === "plan_item") {
        const itemId = text(event.data.id); if (!itemId) continue;
        if (!thoughts.has(itemId)) order.push(itemId);
        const next = text(event.data.thought) ?? ""; const old = thoughts.get(itemId) ?? "";
        if (next.length < old.length) continue;
        thoughts.set(itemId, next);
        const current = order.map((key) => thoughts.get(key) ?? "").join(""); const delta = current.slice(emitted); emitted = current.length;
        if (delta) yield { type: "text_delta", index: emitted, text: delta };
      }
      if (event.name === "done") break;
    }
    if (usage) yield { type: "usage", usage };
    yield { type: "stop", stopReason: "end_turn" };
  }

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const content: { type: "text"; text: string }[] = []; let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    for await (const chunk of this.stream(request, credential, ctx)) {
      if (chunk.type === "text_delta") content.push({ type: "text", text: chunk.text });
      else if (chunk.type === "usage") usage = chunk.usage;
    }
    return { id: ctx.requestId, model: request.model, content, stopReason: "end_turn", usage };
  }

  async getModels(): Promise<readonly ListedModel[]> {
    return this.provider.models.map((descriptor) => ({ id: descriptor.id, descriptor }));
  }

  async validateCredential(credential: Credential): Promise<CredentialStatus> {
    return credential.apiKey ? { valid: true } : { valid: false, code: "AUTH_ERROR", message: "Trae access token is missing" };
  }
}
