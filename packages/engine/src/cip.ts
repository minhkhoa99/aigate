// Canonical Internal Protocol (spec §3). Vendor-neutral and a superset of what adapters carry.
// Rule 1: anything not modelled yet travels in `vendorExtensions`, untouched.
// Rule 2: an adapter that cannot represent a field throws UnsupportedFeatureError; it never drops it.

export type VendorExtensions = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type MediaSource =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "base64"; readonly mediaType: string; readonly data: string };

export type ContentPart =
  | { readonly type: "text"; readonly text: string; readonly cacheControl?: "ephemeral" }
  | { readonly type: "image"; readonly source: MediaSource }
  | { readonly type: "audio"; readonly source: MediaSource }
  | { readonly type: "video"; readonly source: MediaSource }
  | { readonly type: "file"; readonly mediaType: string; readonly source: MediaSource; readonly name?: string }
  | { readonly type: "tool_call"; readonly id: string; readonly name: string; readonly arguments: string }
  | { readonly type: "tool_result"; readonly toolCallId: string; readonly content: readonly ContentPart[]; readonly isError?: boolean }
  // Reasoning is kept whole, including the signature and redacted blocks that an OpenAI pivot loses.
  | { readonly type: "thinking"; readonly text: string; readonly signature?: string; readonly redacted?: boolean };

export interface CanonicalMessage {
  readonly role: "user" | "assistant" | "tool";
  readonly content: readonly ContentPart[];
}

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  // JSON Schema for the arguments, carried as given.
  readonly parameters: Readonly<Record<string, unknown>>;
}

export type ToolChoice = "auto" | "none" | "required" | { readonly name: string };

export interface CanonicalRequest {
  readonly model: string;
  readonly system?: readonly ContentPart[];
  readonly messages: readonly CanonicalMessage[];
  readonly tools?: readonly ToolDefinition[];
  readonly toolChoice?: ToolChoice;
  readonly stream: boolean;
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly stop?: readonly string[];
  readonly reasoning?: { readonly effort?: "low" | "medium" | "high"; readonly budgetTokens?: number };
  readonly vendorExtensions?: VendorExtensions;
}

// Normalized across providers: inputTokens excludes cache reads and writes, and outputTokens includes
// reasoningTokens (docs/contracts/provider-openai.md).
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly reasoningTokens?: number;
}

export type StopReason = "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "content_filter";

export interface CanonicalResponse {
  readonly id: string;
  readonly model: string;
  readonly content: readonly ContentPart[];
  readonly stopReason: StopReason;
  readonly usage: TokenUsage;
  readonly vendorExtensions?: VendorExtensions;
}

export type StreamChunk =
  | { readonly type: "start"; readonly id: string; readonly model: string }
  | { readonly type: "text_delta"; readonly index: number; readonly text: string }
  | { readonly type: "thinking_delta"; readonly index: number; readonly text: string; readonly signature?: string }
  | { readonly type: "tool_call_delta"; readonly index: number; readonly id?: string; readonly name?: string; readonly argumentsDelta: string }
  | { readonly type: "usage"; readonly usage: TokenUsage }
  | { readonly type: "stop"; readonly stopReason: StopReason };

// Thrown by an adapter when the target cannot carry a feature, instead of silently dropping it.
export class UnsupportedFeatureError extends Error {
  readonly feature: string;
  readonly target: string;

  constructor(feature: string, target: string) {
    super(`${target} cannot carry ${feature}`);
    this.name = "UnsupportedFeatureError";
    this.feature = feature;
    this.target = target;
  }
}
