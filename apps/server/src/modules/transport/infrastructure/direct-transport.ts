import { Injectable } from "@nestjs/common";
import { EngineError, type ExecCtx, type HttpRequest, type HttpResponse, type HttpTransportPort } from "@aigate/engine";

// SP8 direct branch (docs/contracts/transport.md). This file is the only place in the server and the
// engine allowed to call fetch (lint: aigate/fetch-through-transport).
export const MAX_TIMEOUT_MS = 600_000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

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
        body: request.body,
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
}
