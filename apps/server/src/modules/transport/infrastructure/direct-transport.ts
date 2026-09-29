import { Injectable } from "@nestjs/common";
import { Resolver } from "node:dns";
import { request as httpsRequest } from "node:https";
import * as http2 from "node:http2";
import { Readable } from "node:stream";
import { ProxyAgent, fetch as proxyFetch } from "undici";
import { EngineError, type ExecCtx, type HttpRequest, type HttpResponse, type HttpTransportPort, type ProxyConfig } from "@aigate/engine";

// SP8 direct branch (docs/contracts/transport.md). This file is the only place in the server and the
// engine allowed to call fetch (lint: aigate/fetch-through-transport).
export const MAX_TIMEOUT_MS = 600_000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_HTTP2_QUEUE_BYTES = 1024 * 1024;
const PROXY_CACHE_MAX = 20;
const PROXY_CACHE_TTL_MS = 300_000;
const proxyDispatchers = new Map<string, { dispatcher: ProxyAgent; usedAt: number }>();
const MITM_BYPASS_HOSTS = new Set([
  "cloudcode-pa.googleapis.com", "daily-cloudcode-pa.googleapis.com", "api.individual.githubcopilot.com",
  "runtime.us-east-1.kiro.dev", "q.us-east-1.amazonaws.com", "codewhisperer.us-east-1.amazonaws.com", "api2.cursor.sh",
]);
const DNS_CACHE_TTL_MS = 300_000;
const dnsCache = new Map<string, { address: string; expiresAt: number }>();
const asErrno = (error: unknown): NodeJS.ErrnoException => error instanceof Error ? error : new Error(String(error));

function noProxy(host: string, rules: readonly string[]): boolean {
  return rules.some((rule) => rule === "*" || host === rule || (rule.startsWith(".") && host.endsWith(rule)));
}

function envProxy(url: URL): ProxyConfig | undefined {
  const raw = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.ALL_PROXY;
  const rules = (process.env.NO_PROXY ?? process.env.no_proxy ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).slice(0, 100);
  if (!raw || noProxy(url.hostname.toLowerCase(), rules)) return undefined;
  return { url: raw, noProxy: rules, relay: false, strict: false };
}

function dispatcher(url: string): ProxyAgent {
  const now = Date.now();
  const existing = proxyDispatchers.get(url);
  if (existing && now - existing.usedAt < PROXY_CACHE_TTL_MS) {
    existing.usedAt = now;
    proxyDispatchers.delete(url);
    proxyDispatchers.set(url, existing);
    return existing.dispatcher;
  }
  if (existing) {
    proxyDispatchers.delete(url);
    void existing.dispatcher.close();
  }
  while (proxyDispatchers.size >= PROXY_CACHE_MAX) {
    const first = proxyDispatchers.entries().next();
    if (first.done) break;
    proxyDispatchers.delete(first.value[0]);
    void first.value[1].dispatcher.close();
  }
  const created = new ProxyAgent(url);
  proxyDispatchers.set(url, { dispatcher: created, usedAt: now });
  return created;
}

function allowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EngineError("INVALID_REQUEST", "Transport refuses a malformed URL");
  }
  // Credentials never travel in clear text off this machine; local model servers may use http.
  if (url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))) return url;
  throw new EngineError("INVALID_REQUEST", `Transport refuses ${url.protocol}//${url.host}: only https, or http to this machine`, { host: url.host });
}

// One mapping for every failure, so adapters never guess: the caller abort keeps its own reason,
// the per-request deadline becomes TIMEOUT, anything else is PROVIDER_UNAVAILABLE.
function classify(error: unknown, ctx: ExecCtx, host: string, timeoutMs: number): unknown {
  if (ctx.signal.aborted) return ctx.signal.reason;
  if (error instanceof EngineError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new EngineError("TIMEOUT", `${host} did not finish within ${timeoutMs} ms`, { host, timeoutMs }, { cause: error });
  }
  return new EngineError("PROVIDER_UNAVAILABLE", `Could not reach ${host}`, { host }, { cause: error });
}

// Re-emits the upstream body, translating read failures with classify(), so a stalled or aborted
// stream surfaces as TIMEOUT or the caller's reason instead of a bare DOMException.
interface SourceBody {
  getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(reason?: unknown): Promise<void> };
  cancel(reason?: unknown): Promise<void>;
}

function classifiedBody(body: SourceBody, ctx: ExecCtx, host: string, timeoutMs: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else if (value instanceof Uint8Array) controller.enqueue(value);
        else controller.error(new EngineError("PROVIDER_UNAVAILABLE", `${host} sent a non-byte response body`, { host }));
      } catch (error) {
        controller.error(classify(error, ctx, host, timeoutMs));
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function fetchBody(body: string | Uint8Array | undefined): string | ArrayBuffer | undefined {
  if (!(body instanceof Uint8Array)) return body;
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}

function googleAddress(host: string, signal: AbortSignal): Promise<string> {
  const cached = dnsCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.address);
  dnsCache.delete(host);
  return new Promise((resolve, reject) => {
    const resolver = new Resolver();
    resolver.setServers(["8.8.8.8", "8.8.4.4"]);
    const abort = () => { resolver.cancel(); reject(signal.reason); };
    const done = (error: NodeJS.ErrnoException | null, addresses: string[]) => {
      signal.removeEventListener("abort", abort);
      if (error || !addresses[0]) { reject(error ?? new Error("Google DNS returned no IPv4 address")); return; }
      dnsCache.set(host, { address: addresses[0], expiresAt: Date.now() + DNS_CACHE_TTL_MS });
      resolve(addresses[0]);
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    resolver.resolve4(host, done);
  });
}

function http2Client(url: URL, signal: AbortSignal) {
  const host = url.hostname.toLowerCase();
  if (!MITM_BYPASS_HOSTS.has(host)) return http2.connect(url.origin);
  return http2.connect(url.origin, {
    lookup: (_hostname, _options, callback) => {
      void googleAddress(host, signal).then((address) => callback(null, address, 4), (error: unknown) => callback(asErrno(error), "", 4));
    },
  });
}

async function mitmBypassRequest(request: HttpRequest, url: URL, signal: AbortSignal): Promise<{ status: number; headers: Headers; body: SourceBody | null }> {
  const address = await googleAddress(url.hostname, signal);
  return new Promise((resolve, reject) => {
    const outgoing = httpsRequest(url, {
      method: request.method,
      headers: request.headers,
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      signal,
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string") headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(", "));
      }
      resolve({
        status: incoming.statusCode ?? 0,
        headers,
        body: incoming.statusCode === 204 || incoming.statusCode === 304 || request.method === "HEAD"
          ? (incoming.destroy(), null)
          : Readable.toWeb(incoming),
      });
    });
    outgoing.once("error", reject);
    outgoing.end(request.body);
  });
}

function relayRequest(request: HttpRequest, target: URL, proxy: ProxyConfig): RequestInit {
  const relay = new URL(proxy.url);
  if (relay.protocol !== "https:") throw new EngineError("INVALID_REQUEST", "Relay URLs must use HTTPS");
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-relay-target", target.origin);
  headers.set("x-relay-path", `${target.pathname}${target.search}`);
  return { method: request.method, headers, body: fetchBody(request.body), redirect: "manual" };
}

@Injectable()
export class DirectTransport implements HttpTransportPort {
  async send(request: HttpRequest, ctx: ExecCtx): Promise<HttpResponse> {
    const { timeoutMs } = request;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new RangeError(`timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}`);
    }
    const url = allowedUrl(request.url);
    ctx.signal.throwIfAborted();
    let response: { status: number; headers: Headers; body: SourceBody | null };
    try {
      const configured = ctx.proxy && !noProxy(url.hostname.toLowerCase(), ctx.proxy.noProxy) ? ctx.proxy : undefined;
      const proxy = configured ?? envProxy(url);
      if (proxy?.relay) {
        response = await fetch(proxy.url, { ...relayRequest(request, url, proxy), signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]) });
      } else if (proxy) {
        try {
          response = await proxyFetch(url, { method: request.method, headers: request.headers, body: fetchBody(request.body), redirect: "manual", signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]), dispatcher: dispatcher(proxy.url) });
        } catch (error) {
          if (proxy.strict) throw error;
          const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]);
          response = MITM_BYPASS_HOSTS.has(url.hostname.toLowerCase())
            ? await mitmBypassRequest(request, url, signal)
            : await fetch(url, { method: request.method, headers: request.headers, body: fetchBody(request.body), redirect: "manual", signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]) });
        }
      } else {
        const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]);
        response = MITM_BYPASS_HOSTS.has(url.hostname.toLowerCase())
          ? await mitmBypassRequest(request, url, signal)
          : await fetch(url, { method: request.method, headers: request.headers, body: fetchBody(request.body), redirect: "manual", signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]) });
      }
    } catch (error) {
      throw classify(error, ctx, url.host, timeoutMs);
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new EngineError("PROVIDER_UNAVAILABLE", `${url.host} answered with a redirect (${response.status}), which the transport refuses`, {
        host: url.host, status: response.status,
      });
    }
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: response.body ? classifiedBody(response.body, ctx, url.host, timeoutMs) : null,
    };
  }

  async sendHttp2(request: HttpRequest, ctx: ExecCtx, maxBytes: number) {
    if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new RangeError("maxBytes must be a positive integer");
    const url = this.http2Url(request, ctx);
    return new Promise<{ status: number; headers: Readonly<Record<string, string>>; body: Uint8Array }>((resolve, reject) => {
      const client = http2Client(url, ctx.signal);
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      let headers: Readonly<Record<string, string>> = {};
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.close();
        action();
      };
      const fail = (error: unknown) => finish(() => reject(classify(error, ctx, url.host, request.timeoutMs)));
      const timer = setTimeout(() => fail(new DOMException("Timed out", "TimeoutError")), request.timeoutMs);
      client.on("error", fail);
      const stream = client.request({ ":method": request.method, ":path": `${url.pathname}${url.search}`, ":authority": url.host, ":scheme": "https", ...request.headers });
      stream.on("response", (value) => { headers = Object.fromEntries(Object.entries(value).flatMap(([name, header]) => typeof header === "string" || typeof header === "number" ? [[name, String(header)]] : [])); });
      stream.on("data", (chunk: Uint8Array) => {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) {
          stream.destroy();
          fail(new EngineError("PROVIDER_UNAVAILABLE", `${url.host} sent more than ${maxBytes} HTTP/2 bytes`, { host: url.host, maxBytes }));
        } else chunks.push(chunk);
      });
      stream.on("end", () => finish(() => {
        const status = Number(headers[":status"] ?? 0);
        if (status >= 300 && status < 400) {
          reject(new EngineError("PROVIDER_UNAVAILABLE", `${url.host} answered with a redirect (${status}), which the transport refuses`, { host: url.host, status }));
          return;
        }
        const body = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        resolve({ status, headers, body });
      }));
      stream.on("error", fail);
      const abort = () => { stream.destroy(); fail(ctx.signal.reason); };
      if (ctx.signal.aborted) abort();
      else ctx.signal.addEventListener("abort", abort, { once: true });
      stream.end(request.body);
    });
  }

  openHttp2(request: HttpRequest, ctx: ExecCtx) {
    const url = this.http2Url(request, ctx);
    const client = http2Client(url, ctx.signal);
    const stream = client.request({ ":method": request.method, ":path": `${url.pathname}${url.search}`, ":authority": url.host, ":scheme": "https", ...request.headers });
    const queue: Uint8Array[] = [];
    let queued = 0;
    let done = false;
    let error: unknown;
    let wake: ((value: { done: boolean; value?: Uint8Array }) => void) | undefined;
    let rejectHeaders: ((reason: unknown) => void) | undefined;
    let resolveHeaders: ((value: { status: number; headers: Readonly<Record<string, string>> }) => void) | undefined;
    const response = new Promise<{ status: number; headers: Readonly<Record<string, string>> }>((resolve, reject) => { resolveHeaders = resolve; rejectHeaders = reject; });
    let stopped = false;
    const close = () => {
      if (stopped) return;
      stopped = true;
      stream.destroy();
      client.close();
    };
    const fail = (cause: unknown) => {
      if (error !== undefined) return;
      error = classify(cause, ctx, url.host, request.timeoutMs);
      done = true;
      rejectHeaders?.(error);
      wake?.({ done: true });
      close();
    };
    const timer = setTimeout(() => fail(new DOMException("Timed out", "TimeoutError")), request.timeoutMs);
    const complete = () => { done = true; clearTimeout(timer); wake?.({ done: true }); };
    client.on("error", fail);
    stream.on("error", fail);
    stream.on("response", (value) => {
      const headers = Object.fromEntries(Object.entries(value).flatMap(([name, header]) => typeof header === "string" || typeof header === "number" ? [[name, String(header)]] : []));
      resolveHeaders?.({ status: Number(headers[":status"] ?? 0), headers });
    });
    stream.on("data", (chunk: Uint8Array) => {
      if (queued + chunk.byteLength > MAX_HTTP2_QUEUE_BYTES) {
        fail(new EngineError("PROVIDER_UNAVAILABLE", `${url.host} exceeded the HTTP/2 receive queue`, { host: url.host, maxBytes: MAX_HTTP2_QUEUE_BYTES }));
        return;
      }
      if (wake) { const current = wake; wake = undefined; current({ done: false, value: chunk }); }
      else { queue.push(chunk); queued += chunk.byteLength; }
    });
    stream.on("end", complete);
    const abort = () => fail(ctx.signal.reason);
    if (ctx.signal.aborted) abort();
    else ctx.signal.addEventListener("abort", abort, { once: true });
    return {
      response,
      write: (body: Uint8Array) => { if (!done && !stopped) stream.write(body); },
      end: () => { if (!done && !stopped) stream.end(); },
      close,
      read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
        if (queue.length > 0) { const value = queue.shift()!; queued -= value.byteLength; return { done: false, value }; }
        if (error !== undefined) throw error;
        if (done) return { done: true };
        return new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => { wake = resolve; }).then((value) => { if (error !== undefined) throw error; return value; });
      },
    };
  }

  private http2Url(request: HttpRequest, ctx: ExecCtx): URL {
    if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 1 || request.timeoutMs > MAX_TIMEOUT_MS) throw new RangeError(`timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}`);
    const url = allowedUrl(request.url);
    if (url.protocol !== "https:") throw new EngineError("INVALID_REQUEST", `${url.host} requires HTTPS for HTTP/2`);
    ctx.signal.throwIfAborted();
    return url;
  }
}
