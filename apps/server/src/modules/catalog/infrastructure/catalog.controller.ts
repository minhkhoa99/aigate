import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Put, Query } from "@nestjs/common";
import { builtinRegistry, CATALOG, isThinkingLevel, mediaService, thinkingLevels, ttsVoices, type CatalogProvider, type MediaService, type ThinkingLevel } from "@aigate/engine";
import { ProviderThinkingRepository } from "./provider-thinking.repo.js";

// docs/contracts/catalog-providers.md. The whole catalog for the dashboard, with each provider's
// connectable status. Protected by the global dashboard guard. Static data: read from memory only.

interface ProviderSummary {
  id: string;
  name: string;
  aliases: readonly string[];
  category: string;
  protocol: string;
  authKinds: readonly string[];
  hidden: boolean;
  connectable: boolean;
  reason: string | null;
  // SP16 (docs/contracts/oauth.md): how the dashboard signs in to the provider, or null when it takes only a key.
  signIn: string | null;
  // The provider takes no API key: it connects only by signing in.
  signInOnly: boolean;
  modelCount: number;
  serviceKinds: readonly string[];
  routeKinds: readonly string[];
}

function routeKinds(provider: CatalogProvider): string[] {
  const runtime = builtinRegistry.provider(provider.id);
  const service = mediaService(provider.id);
  const chatMedia = runtime?.protocol === "openai-compatible" && /\/chat\/completions(?:\?.*)?$/.test(runtime.chatUrl);
  return provider.serviceKinds.filter((kind) => {
    if (kind === "webSearch") return Boolean(service?.search);
    if (kind === "webFetch") return Boolean(service?.fetch);
    if (kind === "video") return provider.id === "xai" && Boolean(runtime);
    if (kind === "imageToText") return Boolean(runtime?.models.some((model) => model.kind === "chat" && model.capabilities.vision));
    if (kind === "embedding") return Boolean(provider.id === "gemini" || (chatMedia && runtime?.models.some((model) => model.kind === "embedding")));
    if (kind === "image" || kind === "tts" || kind === "stt") return Boolean(chatMedia && runtime?.models.some((model) => model.kind === kind));
    return false;
  });
}

function summary(provider: CatalogProvider): ProviderSummary {
  const status = builtinRegistry.status(provider.id);
  return {
    id: provider.id,
    name: provider.name,
    aliases: provider.aliases,
    category: provider.category,
    protocol: provider.protocol,
    authKinds: provider.auth.kinds,
    hidden: provider.hidden,
    connectable: status?.connectable ?? false,
    reason: status && !status.connectable ? status.reason : null,
    signIn: builtinRegistry.provider(provider.id)?.oauth ?? null,
    signInOnly: !provider.auth.kinds.includes("api-key"),
    modelCount: provider.models.length,
    serviceKinds: provider.serviceKinds,
    routeKinds: routeKinds(provider),
  };
}

const mediaSummary = (service: MediaService): ProviderSummary => ({
  id: service.id, name: service.name, aliases: [], category: "service", protocol: "service", authKinds: ["api-key"], hidden: false,
  connectable: true, reason: null, signIn: null, signInOnly: false, modelCount: 0, serviceKinds: [], routeKinds: [],
});

// docs/contracts/provider-thinking.md: the picker's levels (null when no model of the provider reasons) and the stored one.
type ThinkingView = { level: ThinkingLevel | "auto"; levels: readonly ThinkingLevel[] | null };

const find = (id: string): CatalogProvider => {
  const provider = CATALOG.find((p) => p.id === id);
  if (!provider) throw new NotFoundException({ code: "NOT_FOUND", message: `No provider "${id}" in the catalog` });
  return provider;
};

// Only a provider the adapters can serve has a runtime descriptor, and so levels.
const levelsOf = (provider: CatalogProvider): readonly ThinkingLevel[] | null => {
  const runtime = builtinRegistry.provider(provider.id);
  return runtime ? thinkingLevels(runtime) : null;
};

@Controller("api/providers")
export class CatalogController {
  constructor(private readonly thinking: ProviderThinkingRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): ProviderSummary[] {
    return CATALOG.map((provider) => {
      const service = mediaService(provider.id);
      const base = summary(provider);
      return service && !base.connectable ? { ...base, ...mediaSummary(service), serviceKinds: base.serviceKinds, routeKinds: base.routeKinds } : base;
    });
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async detail(@Param("id") id: string) {
    const provider = find(id);
    // The runtime view of the models (limits sanitized) when the provider is connectable; the catalog's otherwise.
    const runtime = builtinRegistry.provider(provider.id);
    const models = (runtime?.models ?? provider.models).map((m) => ({
      id: m.id, name: m.name, kind: m.kind === "llm" ? "chat" : m.kind, capabilities: m.capabilities, contextWindow: m.contextWindow, maxOutputTokens: m.maxOutputTokens,
    }));
    const thinking: ThinkingView = { level: (await this.thinking.get(provider.id)) ?? "auto", levels: levelsOf(provider) };
    return { ...summary(provider), chatUrl: provider.chatUrl, models, thinking };
  }

  @Get(":id/voices")
  @Header("Cache-Control", "no-store")
  voices(@Param("id") id: string, @Query("model") model = "") {
    const provider = find(id);
    if (!provider.serviceKinds.includes("tts") || (model && !provider.models.some((entry) => entry.kind === "tts" && entry.id === model))) {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "Choose a TTS model from this provider." });
    }
    return { voices: ttsVoices(id, model) };
  }

  // PUT /api/providers/{id}/thinking { level }: auto, or one of the provider's levels (routing.provider-thinking-default).
  @Put(":id/thinking")
  @Header("Cache-Control", "no-store")
  async setThinking(@Param("id") id: string, @Body() body: unknown): Promise<ThinkingView> {
    const provider = find(id);
    const levels = levelsOf(provider);
    if (!levels) throw new BadRequestException({ code: "INVALID_REQUEST", message: `${provider.name} has no model that reasons, so it takes no thinking level` });
    const fields = typeof body === "object" && body !== null && !Array.isArray(body) ? Object.fromEntries(Object.entries(body)) : undefined;
    const level: unknown = fields?.level;
    const allowed = level === "auto" || (isThinkingLevel(level) && levels.includes(level));
    if (!fields || Object.keys(fields).some((key) => key !== "level") || !allowed) {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: `Send { level } with auto or one of ${levels.join(", ")}` });
    }
    await this.thinking.set(provider.id, level);
    return { level, levels };
  }
}
