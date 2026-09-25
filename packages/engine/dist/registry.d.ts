export interface ModelCapabilities {
    readonly vision: boolean;
    readonly pdf: boolean;
    readonly audioInput: boolean;
    readonly videoInput: boolean;
    readonly tools: boolean;
    readonly reasoning: boolean;
}
export type ModelKind = "chat" | "embedding";
export interface ModelDescriptor {
    readonly id: string;
    readonly name: string;
    readonly kind: ModelKind;
    readonly capabilities: ModelCapabilities;
    readonly contextWindow: number;
    readonly maxOutputTokens: number;
}
export interface ProviderDescriptor {
    readonly id: string;
    readonly name: string;
    readonly protocol: "openai-compatible";
    readonly baseUrl: string;
    readonly auth: {
        readonly kind: "api-key";
        readonly header: "authorization";
        readonly scheme: "Bearer";
    };
    readonly models: readonly ModelDescriptor[];
}
export interface Registry {
    readonly providers: readonly ProviderDescriptor[];
    provider(id: string): ProviderDescriptor | undefined;
    model(providerId: string, modelId: string): ModelDescriptor | undefined;
}
export declare class RegistryError extends Error {
    readonly problems: readonly string[];
    constructor(problems: readonly string[]);
}
export declare function defineRegistry(providers: readonly ProviderDescriptor[]): Registry;
