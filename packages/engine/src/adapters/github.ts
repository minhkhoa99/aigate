import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { list, parseJson, record, text } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpTransportPort, ListedModel } from "../ports.js";
import { MODEL_ID, type ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { withClaudeCodePrompt } from "./claude-code.js";
import { collected } from "./collect.js";
import { METADATA_TIMEOUT_MS } from "./http-adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";

// provider.github-copilot-oauth (docs/contracts/oauth.md), kept as 9router's GithubExecutor has it (user decision
// 2026-09-27): a model named *claude* goes to Copilot's /v1/messages, a model known to need it to /responses (both always
// streamed), anything else to /chat/completions, and a 400 saying the model is not served there moves it to /responses
// for the rest of the process. The credential is the Copilot token.

const BASE = "https://api.githubcopilot.com";
const MAX_LISTED_MODELS = 1_000;
// 9router's model list names older VS Code and Copilot Chat versions than its requests (kept).
const MODELS_HEADERS = {
  "content-type": "application/json", "copilot-integration-id": "vscode-chat", "editor-version": "vscode/1.107.1", "editor-plugin-version": "copilot-chat/0.26.7",
  "user-agent": "GitHubCopilotChat/0.26.7",
};
const MOVE_TO_RESPONSES = ["not accessible via the /chat/completions endpoint", "The requested model is not supported"];
// Remembered per process, as 9router's knownCodexModels (a restart pays one failed call per model again).
const responsesModels = new Set<string>();

const isClaude = (model: string) => /claude/i.test(model);
// Copilot's /responses serves only OpenAI models.
const servesResponses = (model: string) => !/gemini|claude/i.test(model);

export class GithubAdapter implements AIProviderPort {
  private readonly provider: ProviderDescriptor;
  private readonly transport: HttpTransportPort;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    this.provider = provider;
    this.transport = transport;
  }

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    if (isClaude(request.model) || this.onResponses(request.model)) return collected(this.stream({ ...request, stream: true }, credential, ctx), request.model);
    try {
      return await this.chat().execute(request, credential, ctx);
    } catch (error) {
      if (!this.movesToResponses(error, request.model)) throw error;
      responsesModels.add(request.model);
      return collected(this.responses().stream({ ...request, stream: true }, credential, ctx), request.model);
    }
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    // 9router's /v1/messages translation always puts the Claude Code prompt in front.
    if (isClaude(request.model)) return yield* this.messages().stream(withClaudeCodePrompt({ ...request, stream: true }), credential, ctx);
    if (this.onResponses(request.model)) return yield* this.responses().stream({ ...request, stream: true }, credential, ctx);
    const iterator = this.chat().stream(request, credential, ctx)[Symbol.asyncIterator]();
    let step: IteratorResult<StreamChunk>;
    try {
      step = await iterator.next();
    } catch (error) {
      if (!this.movesToResponses(error, request.model)) throw error;
      responsesModels.add(request.model);
      return yield* this.responses().stream({ ...request, stream: true }, credential, ctx);
    }
    try {
      for (; !step.done; step = await iterator.next()) yield step.value;
    } finally {
      await iterator.return?.(undefined);
    }
  }

  // 9router's Copilot model list: chat models that are not disabled, read with the stored Copilot token.
  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const response = await this.transport.send({
      method: "GET", url: `${BASE}/models`, headers: { ...MODELS_HEADERS, authorization: `Bearer ${credential.apiKey}` }, timeoutMs: METADATA_TIMEOUT_MS,
    }, ctx);
    const raw = await readBoundedText(response.body);
    if (response.status < 200 || response.status >= 300) {
      const code = response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE";
      throw new EngineError(code, `${this.provider.name} answered ${response.status}`, { provider: this.provider.id, status: response.status });
    }
    const known = new Map(this.provider.models.map((model) => [model.id, model]));
    return list(record(parseJson(raw)).data).map(record)
      .filter((model) => record(model.capabilities).type === "chat" && record(model.policy).state !== "disabled")
      .flatMap((model) => {
        const id = text(model.id);
        if (id === undefined || !MODEL_ID.test(id)) return [];
        const descriptor = known.get(id);
        return [descriptor ? { id, descriptor } : { id }];
      })
      .slice(0, MAX_LISTED_MODELS);
  }

  // The dashboard tests a github connection with its GitHub token (oauth.ts); this is the chat adapter's check.
  validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return this.chat().validateCredential(credential, ctx);
  }

  private onResponses(model: string): boolean {
    return responsesModels.has(model) && servesResponses(model);
  }

  private movesToResponses(error: unknown, model: string): boolean {
    return error instanceof EngineError && error.details.status === 400 && servesResponses(model) && MOVE_TO_RESPONSES.some((phrase) => error.message.includes(phrase));
  }

  // The executor's headers on every call, with a new request id (anthropic-version is harmless off /v1/messages).
  private headers(): Record<string, string> {
    return { ...this.provider.headers, "x-request-id": crypto.randomUUID(), "anthropic-version": "2023-06-01" };
  }

  private chat(): OpenAICompatibleAdapter {
    return new OpenAICompatibleAdapter({ ...this.provider, headers: this.headers(), quirks: [...(this.provider.quirks ?? []), "copilotChat"] }, this.transport);
  }

  private messages(): AnthropicAdapter {
    return new AnthropicAdapter({ ...this.provider, protocol: "anthropic", chatUrl: `${BASE}/v1/messages`, headers: this.headers(), quirks: ["copilotMessages"] }, this.transport);
  }

  private responses(): OpenAIResponsesAdapter {
    return new OpenAIResponsesAdapter({ ...this.provider, protocol: "openai-responses", chatUrl: `${BASE}/responses`, headers: this.headers() }, this.transport);
  }
}
