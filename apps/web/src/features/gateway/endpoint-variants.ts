// docs/contracts/endpoint-setup.md: static examples for the four implemented client lanes.
export const clientProtocols = ["openai", "anthropic", "responses", "gemini"] as const;
export type ClientProtocol = (typeof clientProtocols)[number];

const key = "<your AIGate key>";
const model = "openai/gpt-4.1-mini";
const command = (url: string, header: string, body: unknown) =>
  `curl '${url}' -H '${header}' -H 'Content-Type: application/json' -d '${JSON.stringify(body)}'`;

export function endpointSetup(origin: string, protocol: ClientProtocol) {
  const base = `${origin}/v1`;
  switch (protocol) {
    case "openai": {
      const url = `${base}/chat/completions`;
      return { displayUrl: base, setup: `export OPENAI_BASE_URL='${base}' OPENAI_API_KEY='${key}'`,
        testRequest: command(url, `Authorization: Bearer ${key}`, { model, messages: [{ role: "user", content: "Hello" }] }) };
    }
    case "anthropic": {
      const url = `${base}/messages`;
      return { displayUrl: origin, setup: `export ANTHROPIC_BASE_URL='${origin}' ANTHROPIC_API_KEY='${key}'`,
        testRequest: command(url, `x-api-key: ${key}`, { model, max_tokens: 256, stream: false, messages: [{ role: "user", content: "Hello" }] }) };
    }
    case "responses": {
      const url = `${base}/responses`;
      return { displayUrl: base, setup: `OPENAI_BASE_URL='${base}' OPENAI_API_KEY='${key}' codex -m ${model}`,
        testRequest: command(url, `Authorization: Bearer ${key}`, { model, stream: false, input: "Hello" }) };
    }
    case "gemini": {
      const url = `${origin}/v1beta/models/${model}:generateContent`;
      return { displayUrl: url, setup: null,
        testRequest: command(url, `Authorization: Bearer ${key}`, { contents: [{ role: "user", parts: [{ text: "Hello" }] }] }) };
    }
  }
}
