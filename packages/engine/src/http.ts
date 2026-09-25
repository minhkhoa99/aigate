import { EngineError } from "./errors.js";

// Upstream error pages and JSON bodies are small; anything larger is refused instead of buffered.
export const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

// Reads a whole response body as UTF-8 without ever holding more than maxBytes. Over the limit, the
// stream is cancelled and PROVIDER_UNAVAILABLE is thrown; the caller never sees a truncated body.
export async function readBoundedText(body: ReadableStream<Uint8Array> | null, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new RangeError("maxBytes must be a positive integer");
  if (body === null) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel("response too large");
      throw new EngineError("PROVIDER_UNAVAILABLE", `Upstream response exceeded ${maxBytes} bytes`, { maxBytes });
    }
    text += decoder.decode(value, { stream: true });
  }
}
