import { Injectable } from "@nestjs/common";
import * as http2 from "node:http2";
import { EngineError, type ExecCtx, type HttpRequest, type HttpResponse, type HttpTransportPort } from "@aigate/engine";

// SP8 direct branch (docs/contracts/transport.md). This file is the only place in the server and the
// engine allowed to call fetch (lint: aigate/fetch-through-transport).
export const MAX_TIMEOUT_MS = 600_000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_HTTP2_QUEUE_BYTES = 1024 * 1024;

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
function classifiedBody(body: ReadableStream<Uint8Array>, ctx: ExecCtx, host: string, timeoutMs: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
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

@Injectable()
export class DirectTransport implements HttpTransportPort {
  async send(request: HttpRequest, ctx: ExecCtx): Promise<HttpResponse> {
    const { timeoutMs } = request;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new RangeError(`timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}`);
    }
    const url = allowedUrl(request.url);
    ctx.signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        body: fetchBody(request.body),
        // A provider API never redirects; following one could send the credential to another host.
        redirect: "manual",
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]),
      });
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
      const client = http2.connect(url.origin);
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
    const client = http2.connect(url.origin);
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
