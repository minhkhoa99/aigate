import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import { readBoundedText } from "../http.js";
import { list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { CLOUD_CODE, codeAssistMetadata, lookupProject, probeCodeAssist, randomProjectId } from "./cloud-code.js";
import { GeminiAdapter } from "./gemini.js";
import { GEMINI_CLI_THOUGHT_SIGNATURE } from "./gemini-cli-signature.js";
import { METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";

// provider.gemini-cli-oauth (docs/contracts/oauth.md), kept as 9router's GeminiCLIExecutor has it (user decision
// 2026-09-27): the Gemini request inside Cloud Code's envelope at cloudcode-pa.googleapis.com/v1internal, with the
// Gemini CLI's headers; the answer is the Gemini answer inside { response }.

const CLI_VERSION = "0.34.0";
const API_CLIENT = "google-genai-sdk/1.41.0 gl-node/v22.19.0";
const MAX_LISTED_MODELS = 1_000;
const ARCH = process.arch === "ia32" ? "x86" : process.arch;
// The request-path project lookup and the model list claim the Cloud Shell editor client (kept).
const CLOUD_SHELL = { "user-agent": "google-api-nodejs-client/9.15.1", "x-goog-api-client": "google-cloud-sdk vscode_cloudshelleditor/0.1" };
const LOOKUP_HEADERS = { ...CLOUD_SHELL, "client-metadata": JSON.stringify(codeAssistMetadata()) };
const TEST_USER_AGENT = `google-api-nodejs-client/9.15.1 gemini-cli/${CLI_VERSION}`;

// fetchAvailableModels answers an array ({ id | model | name }) or an object keyed by id.
function modelIds(value: unknown): string[] {
  const models = record(value).models;
  if (Array.isArray(models)) return list(models).map(record).flatMap((model) => text(model.id) ?? text(model.model) ?? text(model.name) ?? []);
  return Object.entries(record(models)).flatMap(([id, info]) => (record(info).isInternal ? [] : [id]));
}

export class GeminiCliAdapter extends GeminiAdapter implements AIProviderPort {
  protected override readonly bodyOptions = { borrowed: GEMINI_CLI_THOUGHT_SIGNATURE, callIds: true };

  override async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return super.execute(request, await this.withProject(credential), ctx);
  }

  override async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    yield* super.stream(request, await this.withProject(credential), ctx);
  }

  // Model listing: POST fetchAvailableModels { project } with the stored token.
  override async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const base = this.request("POST", `${CLOUD_CODE}:fetchAvailableModels`, credential, METADATA_TIMEOUT_MS);
    const response = await this.send({
      ...base, headers: { ...base.headers, ...CLOUD_SHELL, "content-type": "application/json" }, body: JSON.stringify({ project: credential.projectId }),
    }, credential, ctx, RETRY.maxAttempts);
    const listed: ListedModel[] = [];
    for (const id of modelIds(parseJson(await readBoundedText(response.body))).slice(0, MAX_LISTED_MODELS)) {
      if (!MODEL_ID.test(id)) continue;
      const descriptor = this.known.get(id);
      listed.push(descriptor ? { id, descriptor } : { id });
    }
    return listed;
  }

  override validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return probeCodeAssist(credential.apiKey, TEST_USER_AGENT, this.transport, ctx);
  }

  protected override generateUrl(_request: CanonicalRequest, _credential: Credential, stream: boolean): string {
    return `${this.provider.chatUrl}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  }

  protected override wrap(gemini: Json, request: CanonicalRequest, credential: Credential): Json {
    return {
      project: credential.projectId || randomProjectId(),
      model: request.model,
      userAgent: "gemini-cli",
      requestId: `agent-${crypto.randomUUID()}`,
      request: {
        // A new session per request (kept): AIGate forwards no client session id.
        sessionId: `${crypto.randomUUID()}${Date.now()}`,
        contents: gemini.contents,
        systemInstruction: gemini.systemInstruction,
        generationConfig: gemini.generationConfig,
        tools: gemini.tools,
        safetySettings: gemini.safetySettings,
        ...(Array.isArray(gemini.tools) && gemini.tools.length > 0 ? { toolConfig: { functionCallingConfig: { mode: "VALIDATED" } } } : {}),
      },
    };
  }

  protected override generate(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const base = super.generate(request, credential, stream);
    return { ...base, headers: { ...base.headers, "user-agent": `GeminiCLI/${CLI_VERSION}/${request.model || "unknown"} (${process.platform}; ${ARCH}; terminal)`, "x-goog-api-client": API_CLIENT } };
  }

  // routing: a connection without a project looks it up first (9router's cold-miss path); none found leaves it empty.
  private async withProject(credential: Credential): Promise<Credential> {
    if (credential.projectId || !credential.sessionId) return credential;
    const project = await lookupProject(credential.sessionId, credential.apiKey, LOOKUP_HEADERS, this.transport);
    return project ? { ...credential, projectId: project } : credential;
  }
}
