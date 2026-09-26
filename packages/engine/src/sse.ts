import { EngineError } from "./errors.js";

// One line, or one event's joined data, may hold at most this many characters; a provider that
// never sends a newline cannot make us buffer without limit (docs/contracts/provider-openai.md).
export const MAX_SSE_EVENT_CHARS = 1024 * 1024;

function tooLarge(maxChars: number): EngineError {
  return new EngineError("PROVIDER_UNAVAILABLE", `Upstream stream event exceeded ${maxChars} characters`, { maxChars });
}

// Yields each non-blank line of a newline-delimited JSON stream (Ollama), with the same bound per line.
// Stopping the iteration early, or any failure, cancels the body.
export async function* readJsonLines(body: ReadableStream<Uint8Array>, maxChars = MAX_SSE_EVENT_CHARS): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const lines = (done ? decoder.decode() : decoder.decode(value, { stream: true })).split("\n");
      lines[0] = buffer + lines[0];
      buffer = done ? "" : (lines.pop() ?? "");
      if (buffer.length > maxChars) throw tooLarge(maxChars);
      for (const line of lines) {
        if (line.length > maxChars) throw tooLarge(maxChars);
        const trimmed = line.trim();
        if (trimmed !== "") yield trimmed;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

// Yields the data of each server-sent event. Comments and fields other than `data` are ignored.
// Stopping the iteration early, or any failure, cancels the body.
// ponytail: lines split on "\n" only (a trailing "\r" is dropped); bare-"\r" endings are not seen in provider APIs.
export async function* readSseData(body: ReadableStream<Uint8Array>, maxChars = MAX_SSE_EVENT_CHARS): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let dataChars = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      // Split only the new text, so a slow drip without newlines costs linear time, not quadratic.
      const lines = (done ? decoder.decode() : decoder.decode(value, { stream: true })).split("\n");
      lines[0] = buffer + lines[0];
      // The last piece has no newline yet; keep it for the next read.
      buffer = done ? "" : (lines.pop() ?? "");
      if (buffer.length > maxChars) throw tooLarge(maxChars);
      for (const raw of lines) {
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        if (line === "") {
          if (data.length > 0) yield data.join("\n");
          data = [];
          dataChars = 0;
        } else if (line.startsWith("data:")) {
          const value = line.slice(line.startsWith("data: ") ? 6 : 5);
          dataChars += value.length;
          if (dataChars > maxChars) throw tooLarge(maxChars);
          data.push(value);
        }
      }
      if (done) {
        // A last event without its blank line still counts.
        if (data.length > 0) yield data.join("\n");
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
