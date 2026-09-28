import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpTransportPort, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

const USER_AGENT = "iFlow-Cli";

export class IFlowAdapter implements AIProviderPort {
  private readonly provider: ProviderDescriptor;
  private readonly transport: HttpTransportPort;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) { this.provider = provider; this.transport = transport; }

  private async adapted(credential: Credential): Promise<OpenAICompatibleAdapter> {
    const session = `session-${crypto.randomUUID()}`;
    const timestamp = String(Date.now());
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(credential.apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${USER_AGENT}:${session}:${timestamp}`))), (value) => value.toString(16).padStart(2, "0")).join("");
    const provider = { ...this.provider, headers: { ...this.provider.headers, "session-id": session, timestamp, "x-iflow-signature": signature, "user-agent": USER_AGENT } };
    return new OpenAICompatibleAdapter(provider, this.transport);
  }

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> { return (await this.adapted(credential)).execute(request, credential, ctx); }
  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> { yield* (await this.adapted(credential)).stream(request, credential, ctx); }
  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> { return (await this.adapted(credential)).getModels(credential, ctx); }
  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> { return (await this.adapted(credential)).validateCredential(credential, ctx); }
}
