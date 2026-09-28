import { type CanonicalRequest, type CanonicalResponse, type ContentPart, type StreamChunk, type ToolDefinition, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpTransportPort, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";

const CHAT_URL = "https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools";
const AGENT_URL = "https://agent.api5.cursor.sh/agent.v1.AgentService/Run";
const MODELS_URL = "https://agent.api5.cursor.sh/agent.v1.AgentService/GetUsableModels";
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MODEL_CACHE_MS = 5 * 60_000;
const MAX_MODEL_CACHES = 100;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
type Field = { readonly wire: number; readonly value: number | Uint8Array };
type Fields = Map<number, Field[]>;
type ToolCall = { id: string; name: string; arguments: string };
const modelCaches = new Map<string, { expiresAt: number; models: readonly ListedModel[] }>();

const bytes = (...parts: readonly Uint8Array[]) => {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.byteLength; }
  return out;
};
const field = (number: number, wire: number, value: string | number | Uint8Array) => {
  if (wire === 2) {
    if (typeof value === "number") throw new TypeError("length-delimited protobuf fields need bytes");
    const raw = typeof value === "string" ? encoder.encode(value) : value;
    return bytes(varint((number << 3) | wire), varint(raw.byteLength), raw);
  }
  if (typeof value !== "number") throw new TypeError("varint protobuf fields need a number");
  return bytes(varint((number << 3) | wire), varint(value));
};
function varint(value: number): Uint8Array {
  const out: number[] = [];
  while (value >= 128) { out.push((value & 127) | 128); value = Math.floor(value / 128); }
  out.push(value);
  return new Uint8Array(out);
}
function readVarint(value: Uint8Array, start: number): [number, number] | undefined {
  let result = 0; let shift = 0;
  for (let at = start; at < value.byteLength && shift < 35; at++, shift += 7) {
    const byte = value[at]; result += (byte & 127) * 2 ** shift;
    if ((byte & 128) === 0) return [result, at + 1];
  }
  return undefined;
}
function decode(raw: Uint8Array): Fields {
  const out: Fields = new Map();
  let at = 0;
  while (at < raw.byteLength) {
    const tag = readVarint(raw, at); if (!tag) break;
    const number = tag[0] >> 3; const wire = tag[0] & 7; at = tag[1];
    let value: number | Uint8Array;
    if (wire === 0) { const parsed = readVarint(raw, at); if (!parsed) break; [value, at] = parsed; }
    else if (wire === 1) { if (at + 8 > raw.byteLength) break; value = raw.slice(at, at + 8); at += 8; }
    else if (wire === 2) { const length = readVarint(raw, at); if (!length || length[1] + length[0] > raw.byteLength) break; value = raw.slice(length[1], length[1] + length[0]); at = length[1] + length[0]; }
    else if (wire === 5) { if (at + 4 > raw.byteLength) break; value = raw.slice(at, at + 4); at += 4; }
    else break;
    const values = out.get(number) ?? []; values.push({ wire, value }); out.set(number, values);
  }
  return out;
}
const nested = (fields: Fields, number: number): Fields | undefined => {
  const value = fields.get(number)?.[0]?.value;
  return value instanceof Uint8Array ? decode(value) : undefined;
};
const string = (fields: Fields | undefined, number: number): string => {
  const value = fields?.get(number)?.[0]?.value;
  return value instanceof Uint8Array ? decoder.decode(value) : "";
};
const number = (fields: Fields | undefined, key: number): number => {
  const value = fields?.get(key)?.[0]?.value;
  return typeof value === "number" ? value : 0;
};
const framed = (payload: Uint8Array) => bytes(new Uint8Array([0, (payload.byteLength >>> 24) & 255, (payload.byteLength >>> 16) & 255, (payload.byteLength >>> 8) & 255, payload.byteLength & 255]), payload);
const text = (parts: readonly ContentPart[]) => parts.filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text").map((part) => part.text).join("\n");
const estimate = (request: CanonicalRequest, output: string): TokenUsage => ({ inputTokens: Math.ceil((text(request.system ?? []).length + request.messages.reduce((sum, message) => sum + text(message.content).length, 0)) / 4), outputTokens: Math.ceil(output.length / 4) });

async function digest(algorithm: "SHA-1" | "SHA-256", value: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(value.byteLength); copy.set(value);
  return new Uint8Array(await crypto.subtle.digest(algorithm, copy));
}
const hex = (value: Uint8Array) => Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
const uuid = (value: Uint8Array) => `${hex(value.slice(0, 4))}-${hex(value.slice(4, 6))}-${hex(value.slice(6, 8))}-${hex(value.slice(8, 10))}-${hex(value.slice(10, 16))}`;
async function sessionId(token: string): Promise<string> {
  const namespace = Uint8Array.from([0x6b, 0xa7, 0xb8, 0x10, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8]);
  const hash = await digest("SHA-1", bytes(namespace, encoder.encode(token)));
  hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
  return uuid(hash);
}
function checksum(machineId: string): string {
  const stamp = Math.floor(Date.now() / 1_000_000);
  const raw = new Uint8Array([stamp >>> 40, stamp >>> 32, stamp >>> 24, stamp >>> 16, stamp >>> 8, stamp]);
  let key = 165;
  for (let index = 0; index < raw.length; index++) { raw[index] = ((raw[index] ^ key) + index) & 255; key = raw[index]; }
  return `${btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}${machineId}`;
}

async function cursorHeaders(credential: Credential): Promise<Readonly<Record<string, string>>> {
  const machineId = credential.providerData?.machineId;
  const id = machineId ?? "";
  if (!id) throw new EngineError("INVALID_REQUEST", "Cursor connection has no machine ID; sign in again by importing it from Cursor IDE", { provider: "cursor" });
  const token = credential.apiKey.includes("::") ? credential.apiKey.split("::")[1] : credential.apiKey;
  if (!token || /[\r\n]/.test(token)) throw new EngineError("AUTH_ERROR", "Cursor access token is invalid", { provider: "cursor" });
  const [clientKey, session] = await Promise.all([digest("SHA-256", encoder.encode(token)).then(hex), sessionId(token)]);
  return {
    authorization: `Bearer ${token}`, "content-type": "application/connect+proto", "user-agent": "connect-es/1.6.1",
    "connect-protocol-version": "1", "x-amzn-trace-id": `Root=${crypto.randomUUID()}`, "x-client-key": clientKey,
    "x-cursor-checksum": checksum(id), "x-cursor-client-version": "3.12.17", "x-cursor-client-commit": "0fb762053c34788bb7760d5673f8a6d4c8589d50",
    "x-cursor-client-type": "ide", "x-cursor-client-os": process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux",
    "x-cursor-client-arch": process.arch === "arm64" ? "aarch64" : "x64", "x-cursor-client-device-type": "desktop",
    "x-cursor-config-version": crypto.randomUUID(), "x-cursor-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", "x-ghost-mode": credential.providerData?.ghostMode === "false" ? "false" : "true",
    "x-request-id": crypto.randomUUID(), "x-session-id": session,
  };
}

function legacyBody(request: CanonicalRequest): Uint8Array {
  const messages = [
    ...(request.system?.length ? [{ role: "user", content: `[System Instructions]\n${text(request.system)}` }] : []),
    ...request.messages.map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: text(message.content) })),
  ].filter((message) => message.content);
  const encoded = messages.map((message, index) => field(1, 2, bytes(field(1, 2, message.content), field(2, 0, message.role === "assistant" ? 2 : 1), field(13, 2, crypto.randomUUID()), field(29, 0, request.tools?.length ? 1 : 0), field(47, 0, request.tools?.length ? 2 : 1), ...(index === messages.length - 1 && request.tools?.length ? [field(51, 2, varint(1))] : []))));
  const thinking = request.reasoning?.effort === "high" ? 2 : request.reasoning?.effort === "medium" ? 1 : 0;
  const body = bytes(...encoded, field(2, 0, 1), field(4, 0, 1), field(5, 2, bytes(field(1, 2, request.model), field(4, 2, new Uint8Array()))), field(13, 0, 1), field(19, 0, 1), field(23, 2, crypto.randomUUID()), field(27, 0, request.tools?.length ? 1 : 0), field(35, 0, 0), field(38, 0, 0), field(46, 0, request.tools?.length ? 2 : 1), field(48, 0, request.tools?.length ? 0 : 1), field(49, 0, thinking), field(51, 0, 0), field(53, 0, 1), field(54, 2, request.tools?.length ? "Agent" : "Ask"));
  return framed(field(1, 2, body));
}

function agentValue(input: unknown): Uint8Array {
  if (input === null || input === undefined) return field(1, 0, 0);
  if (typeof input === "boolean") return field(4, 0, input ? 1 : 0);
  if (typeof input === "number") { const raw = new Uint8Array(8); new DataView(raw.buffer).setFloat64(0, input, true); return field(2, 2, raw); }
  if (typeof input === "string") return field(3, 2, input);
  if (Array.isArray(input)) return field(6, 2, bytes(...input.map((item) => field(1, 2, agentValue(item)))));
  if (typeof input !== "object") return field(3, 2, String(input));
  return field(5, 2, bytes(...Object.entries(input).map(([key, item]) => field(1, 2, bytes(field(1, 2, key), field(2, 2, agentValue(item)))))));
}
function decodeAgentValue(raw: Uint8Array): unknown {
  const value = decode(raw);
  if (value.has(1)) return null;
  if (value.has(4)) return number(value, 4) !== 0;
  if (value.has(2)) { const item = value.get(2)?.[0]?.value; return item instanceof Uint8Array && item.byteLength === 8 ? new DataView(item.buffer, item.byteOffset, 8).getFloat64(0, true) : null; }
  if (value.has(3)) return string(value, 3);
  if (value.has(5)) return Object.fromEntries((nested(value, 5)?.get(1) ?? []).flatMap((item) => { const pair = item.value instanceof Uint8Array ? decode(item.value) : undefined; const key = string(pair, 1); const body = pair?.get(2)?.[0]?.value; return key && body instanceof Uint8Array ? [[key, decodeAgentValue(body)]] : []; }));
  if (value.has(6)) return (nested(value, 6)?.get(1) ?? []).flatMap((item) => item.value instanceof Uint8Array ? [decodeAgentValue(item.value)] : []);
  return null;
}
function toolsBody(tools: readonly ToolDefinition[] | undefined): Uint8Array {
  if (!tools?.length) return new Uint8Array();
  return bytes(...tools.map((tool) => field(1, 2, bytes(field(1, 2, tool.name), field(2, 2, tool.description ?? ""), field(3, 2, agentValue(tool.parameters)), field(4, 2, "aigate"), field(5, 2, tool.name)))));
}

function agentBody(request: CanonicalRequest): Uint8Array {
  const system = text(request.system ?? []);
  const messages = request.messages.filter((message) => message.role !== "tool");
  const last = messages.findLast((message) => message.role === "user") ?? messages.at(-1);
  const history = messages.slice(0, Math.max(0, messages.indexOf(last!))).map((message) => {
    const calls = message.content.filter((part): part is Extract<ContentPart, { type: "tool_call" }> => part.type === "tool_call").map((part) => `[tool_call id=${part.id} name=${part.name} args=${part.arguments}]`).join("\n");
    const said = [text(message.content), calls].filter(Boolean).join("\n");
    return said ? field(1, 2, message.role === "assistant" ? field(2, 2, field(1, 2, field(1, 2, said))) : field(1, 2, field(1, 2, field(1, 2, said)))) : new Uint8Array();
  }).filter((item) => item.byteLength > 0);
  const current = `${system ? `${system}\n\n` : ""}${text(last?.content ?? []) || "Continue."}`;
  const user = bytes(field(1, 2, current), field(2, 2, crypto.randomUUID()), field(3, 2, new Uint8Array()), field(4, 0, 1));
  const action = bytes(field(1, 2, user), ...(history.length ? [field(7, 2, bytes(...history.map((item) => field(1, 2, item))))] : []));
  const model = bytes(field(1, 2, request.model), field(3, 2, request.model), field(4, 2, request.model));
  const run = bytes(field(1, 2, new Uint8Array()), field(2, 2, field(1, 2, action)), field(3, 2, model), ...(request.tools?.length ? [field(4, 2, toolsBody(request.tools))] : []), field(9, 2, bytes(field(1, 2, request.model), field(7, 0, 1))));
  return framed(field(1, 2, run));
}

function responseFrames(raw: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let at = 0; at + 5 <= raw.byteLength;) {
    const length = (raw[at + 1] << 24) | (raw[at + 2] << 16) | (raw[at + 3] << 8) | raw[at + 4];
    if (length < 0 || at + 5 + length > raw.byteLength) break;
    if ((raw[at] & 1) !== 0) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor sent a compressed protobuf frame", { provider: "cursor" });
    if ((raw[at] & 2) === 0) out.push(raw.slice(at + 5, at + 5 + length));
    at += 5 + length;
  }
  return out;
}
function legacyEvents(raw: Uint8Array): { text: string; thinking: string; calls: { id: string; name: string; arguments: string }[] } {
  let textOut = ""; let thinking = ""; const calls = new Map<string, { id: string; name: string; arguments: string }>();
  for (const payload of responseFrames(raw)) {
    const root = decode(payload);
    const response = nested(root, 2);
    if (response) {
      textOut += string(response, 1);
      const thought = nested(response, 25); thinking += string(thought, 1);
    }
    const call = nested(root, 1);
    if (call) {
      const id = string(call, 3).split("\n")[0]; const name = string(call, 9); const args = string(call, 10) || "{}";
      if (id && name) calls.set(id, { id, name, arguments: `${calls.get(id)?.arguments ?? ""}${args}` });
    }
  }
  return { text: textOut, thinking, calls: [...calls.values()] };
}

export class CursorAdapter implements AIProviderPort {
  constructor(private readonly provider: ProviderDescriptor, private readonly transport: HttpTransportPort) {}

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const chunks = await this.collect(request, credential, ctx);
    const content: ContentPart[] = [];
    if (chunks.text) content.push({ type: "text", text: chunks.text });
    for (const call of chunks.calls) content.push({ type: "tool_call", ...call });
    return { id: `chatcmpl-msg_${Date.now()}`, model: request.model, content, stopReason: chunks.calls.length ? "tool_use" : "end_turn", usage: estimate(request, chunks.text) };
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    if (!this.hasMedia(request)) { yield* this.agentStream(request, credential, ctx); return; }
    const result = await this.collect(request, credential, ctx);
    yield { type: "start", id: `chatcmpl-msg_${Date.now()}`, model: request.model };
    if (result.text) yield { type: "text_delta", index: 0, text: result.text };
    for (const [index, call] of result.calls.entries()) yield { type: "tool_call_delta", index, id: call.id, name: call.name, argumentsDelta: call.arguments };
    yield { type: "usage", usage: estimate(request, result.text) };
    yield { type: "stop", stopReason: result.calls.length ? "tool_use" : "end_turn" };
  }

  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const key = credential.sessionId ? credential.sessionId : await digest("SHA-256", encoder.encode(credential.apiKey)).then(hex);
    const cached = modelCaches.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.models;
    try {
      const models = await this.liveModels(credential, ctx);
      const oldest = modelCaches.keys().next().value;
      if (!modelCaches.has(key) && modelCaches.size >= MAX_MODEL_CACHES && oldest) modelCaches.delete(oldest);
      modelCaches.set(key, { expiresAt: Date.now() + MODEL_CACHE_MS, models });
      return models;
    }
    catch { return this.provider.models.map((descriptor) => ({ id: descriptor.id, descriptor })); }
  }

  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    try { await this.liveModels(credential, ctx); return { valid: true }; }
    catch (error) {
      if (error instanceof EngineError && error.code === "AUTH_ERROR") return { valid: false, code: error.code, message: error.message };
      throw error;
    }
  }

  private async liveModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const answer = await this.unary(MODELS_URL, credential, new Uint8Array(), ctx);
    const models: ListedModel[] = [];
    const seen = new Set<string>();
    for (const item of decode(answer).get(1) ?? []) {
      if (!(item.value instanceof Uint8Array)) continue;
      const detail = decode(item.value); const id = string(detail, 1).trim();
      if (id && !seen.has(id)) { seen.add(id); models.push({ id, ...(this.provider.models.find((model) => model.id === id) ? { descriptor: this.provider.models.find((model) => model.id === id)! } : {}) }); }
    }
    if (models.length === 0) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor returned no usable models", { provider: "cursor" });
    return models;
  }

  private hasMedia(request: CanonicalRequest): boolean {
    return request.messages.some((message) => message.content.some((part) => part.type === "image" || part.type === "audio" || part.type === "video" || part.type === "file"));
  }

  private async collect(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<{ text: string; calls: ToolCall[] }> {
    if (this.hasMedia(request)) {
      const raw = await this.unary(CHAT_URL, credential, legacyBody(request), ctx);
      const parsed = legacyEvents(raw);
      return { text: parsed.text || parsed.thinking, calls: parsed.calls };
    }
    let textOut = ""; const calls: ToolCall[] = [];
    for await (const chunk of this.agentStream(request, credential, ctx)) {
      if (chunk.type === "text_delta") textOut += chunk.text;
      if (chunk.type === "tool_call_delta") {
        const existing = calls[chunk.index];
        if (existing) existing.arguments += chunk.argumentsDelta;
        else if (chunk.id && chunk.name) calls[chunk.index] = { id: chunk.id, name: chunk.name, arguments: chunk.argumentsDelta };
      }
    }
    return { text: textOut, calls };
  }

  private async unary(url: string, credential: Credential, body: Uint8Array, ctx: ExecCtx): Promise<Uint8Array> {
    const send = this.transport.sendHttp2;
    if (!send) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor requires an HTTP/2 transport", { provider: "cursor" });
    const headers = await cursorHeaders(credential);
    const answer = await send({ method: "POST", url, headers: url === MODELS_URL ? { ...headers, accept: "application/proto", "content-type": "application/proto" } : headers, body, timeoutMs: TIMEOUT_MS }, ctx, MAX_BYTES);
    if (answer.status >= 200 && answer.status < 300) return answer.body;
    const message = decoder.decode(answer.body.slice(0, 300)).replace(credential.apiKey, "***");
    throw new EngineError(answer.status === 401 || answer.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", `Cursor answered ${answer.status}${message ? `: ${message}` : ""}`, { provider: "cursor", status: answer.status });
  }

  private async *agentStream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const headers = await cursorHeaders(credential);
    const open = this.transport.openHttp2;
    if (!open) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor AgentService requires an HTTP/2 transport", { provider: "cursor" });
    const session = open({ method: "POST", url: AGENT_URL, headers, timeoutMs: TIMEOUT_MS }, ctx);
    session.write(agentBody(request));
    try {
      const response = await session.response;
      if (response.status !== 200) throw new EngineError(response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", `Cursor AgentService answered ${response.status}`, { provider: "cursor", status: response.status });
      const id = `chatcmpl-msg_${Date.now()}`; let pending = new Uint8Array(); let answer = ""; let thinking = ""; let visible = 0; let finished = false;
      yield { type: "start", id, model: request.model };
      for (;;) {
        const item = await session.read(); if (item.done) break;
        pending = bytes(pending, item.value!);
        let offset = 0;
        while (offset + 5 <= pending.byteLength) {
          const length = (pending[offset + 1] << 24) | (pending[offset + 2] << 16) | (pending[offset + 3] << 8) | pending[offset + 4];
          if (length < 0 || offset + 5 + length > pending.byteLength) break;
          const flags = pending[offset]; const payload = pending.slice(offset + 5, offset + 5 + length); offset += 5 + length;
          if ((flags & 1) !== 0) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor sent a compressed protobuf frame", { provider: "cursor" });
          if ((flags & 2) !== 0) continue;
          const root = decode(payload); const update = nested(root, 1);
          if (update) {
            const delta = string(nested(update, 1), 1);
            if (delta) { answer += delta; yield { type: "text_delta", index: 0, text: delta }; }
            const thought = string(nested(update, 4), 1);
            if (thought) {
              thinking += thought;
              if (request.model.toLowerCase().includes("composer")) {
                const content = thinking.includes("</think>") ? thinking.slice(thinking.lastIndexOf("</think>") + 8) : "";
                if (content.length > visible) { const next = content.slice(visible); visible = content.length; answer += next; yield { type: "text_delta", index: 0, text: next }; }
              }
            }
            if (update.has(14)) { if (!answer && thinking) { answer = thinking; yield { type: "text_delta", index: 0, text: thinking }; } finished = true; }
          }
          const kv = nested(root, 4);
          if (kv) session.write(this.kvReply(kv));
          const exec = nested(root, 2);
          if (exec) {
            if (exec.has(10)) session.write(this.execReply(exec, 10, field(1, 2, field(1, 2, new Uint8Array()))));
            else if (exec.has(11)) { const mcp = nested(exec, 11); const name = string(mcp, 5) || string(mcp, 1); if (!name) throw new EngineError("PROVIDER_UNAVAILABLE", "Cursor AgentService requested an unsupported IDE tool", { provider: "cursor" }); const args = Object.fromEntries((mcp?.get(2) ?? []).flatMap((entry) => { const pair = entry.value instanceof Uint8Array ? decode(entry.value) : undefined; const key = string(pair, 1); const raw = pair?.get(2)?.[0]?.value; return key && raw instanceof Uint8Array ? [[key, decodeAgentValue(raw)]] : []; })); yield { type: "tool_call_delta", index: 0, id: string(mcp, 3) || `call_${crypto.randomUUID()}`, name, argumentsDelta: JSON.stringify(args) }; finished = true; }
            else { const variant = [...exec.keys()].find((key) => key !== 1 && key !== 15); if (variant) session.write(this.execReply(exec, variant, variant === 9 ? new Uint8Array() : field(2, 2, field(2, 2, "Tool not available in this environment. Use the MCP tools provided instead.")))); }
          }
          if (finished) { session.end(); yield { type: "usage", usage: estimate(request, answer) }; yield { type: "stop", stopReason: exec?.has(11) ? "tool_use" : "end_turn" }; return; }
        }
        pending = pending.slice(offset);
      }
      if (!answer && thinking) { answer = thinking; yield { type: "text_delta", index: 0, text: thinking }; }
      yield { type: "usage", usage: estimate(request, answer) };
      yield { type: "stop", stopReason: "end_turn" };
    } finally { session.close(); }
  }

  private execReply(exec: Fields, result: number, payload: Uint8Array): Uint8Array {
    const id = number(exec, 1); const execId = string(exec, 15);
    return framed(field(2, 2, bytes(...(id ? [field(1, 0, id)] : []), field(15, 2, execId), field(result, 2, payload))));
  }

  private kvReply(kv: Fields): Uint8Array {
    const id = number(kv, 1); const metadata = kv.get(4)?.[0]?.value;
    const result = kv.has(2) ? field(2, 2, field(1, 2, new Uint8Array())) : field(3, 2, new Uint8Array());
    return framed(field(3, 2, bytes(...(id ? [field(1, 0, id)] : []), result, ...(metadata instanceof Uint8Array ? [field(4, 2, metadata)] : []))));
  }
}
