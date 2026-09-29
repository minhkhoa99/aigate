import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, ListedModel } from "../ports.js";
import type { HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";
import { collected } from "./collect.js";

const BASE = "https://opencode.ai/zen/v1";
const RESPONSE_MODELS = new Set(["muse-spark-1.2-contributor-free", "muse-spark-1.3-contributor-free"]);
const MESSAGE_MODELS = new Set(["union-alpha"]);

// OpenCode's public models use three upstream protocols. Keep the protocol-specific translation in the existing
// family adapters; this small selector owns only the catalog's documented endpoint choice.
export class OpenCodeAdapter implements AIProviderPort {
  private readonly chat: OpenAICompatibleAdapter;
  private readonly responses: OpenAIResponsesAdapter;
  private readonly messages: AnthropicAdapter;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    const common = { ...provider, chatUrl: `${BASE}/chat/completions`, modelsUrl: `${BASE}/models` };
    this.chat = new OpenAICompatibleAdapter(common, transport);
    this.responses = new OpenAIResponsesAdapter({ ...common, protocol: "openai-responses", chatUrl: `${BASE}/responses` }, transport);
    this.messages = new AnthropicAdapter({ ...common, protocol: "anthropic", chatUrl: `${BASE}/messages`, headers: { ...common.headers, "anthropic-version": "2023-06-01" } }, transport);
  }

  private forModel(model: string): AIProviderPort {
    if (RESPONSE_MODELS.has(model)) return this.responses;
    if (MESSAGE_MODELS.has(model)) return this.messages;
    return this.chat;
  }

  execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const adapter = this.forModel(request.model);
    return adapter === this.chat ? adapter.execute(request, credential, ctx) : collected(adapter.stream(request, credential, ctx), request.model);
  }
  stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncIterable<StreamChunk> { return this.forModel(request.model).stream(request, credential, ctx); }
  getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> { return this.chat.getModels(credential, ctx); }
  validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> { return this.chat.validateCredential(credential, ctx); }
}
