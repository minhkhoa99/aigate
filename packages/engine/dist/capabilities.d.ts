import type { CanonicalRequest } from "./cip.js";
import type { ModelCapabilities, ModelDescriptor } from "./registry.js";
export type Capability = keyof ModelCapabilities;
export declare const DEFAULT_CAPABILITIES: ModelCapabilities;
export declare function looksLikeVisionModel(modelId: string): boolean;
export declare function resolveCapabilities(model: ModelDescriptor | undefined, modelId: string): ModelCapabilities;
export declare function detectRequiredCapabilities(request: CanonicalRequest): Set<Capability>;
export declare function assertModelSupports(request: CanonicalRequest, providerId: string, model: ModelDescriptor | undefined, modelId: string): void;
