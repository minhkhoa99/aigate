// Tier 2 (spec §8.1): does the real vendor accept what AIGate sends? Replays each success-class tape,
// takes the upstream request AIGate produced, and sends it to OpenAI with OPENAI_API_KEY (never stored).
// Cost is bounded: gpt-4.1-mini, at most 16 output tokens, one request per success tape.
const OPENAI = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4.1-mini";
const TIMEOUT_MS = 60_000;

export async function live(results, apiKey) {
  const out = [];
  for (const result of results.filter((r) => r.sent && r.theirs.status === 200 && r.id !== "stream-cut")) {
    const body = { ...result.sent.body, model: MODEL, max_completion_tokens: 16 };
    const response = await fetch(OPENAI, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    const streaming = body.stream === true;
    // The right class of answer: a finished SSE stream for a stream request, a chat.completion otherwise.
    const rightClass = streaming ? /event-stream/.test(response.headers.get("content-type") ?? "") && text.includes("data: [DONE]") : /"object":\s*"chat\.completion"/.test(text);
    out.push({ id: result.id, status: response.status, pass: response.ok && rightClass, detail: response.ok ? "" : text.slice(0, 200) });
  }
  return out;
}
