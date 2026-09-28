import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Put } from "@nestjs/common";
import { builtinRegistry, CATALOG, isThinkingLevel, thinkingLevels, type CatalogProvider, type ThinkingLevel } from "@aigate/engine";
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
  };
}

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
    return CATALOG.map(summary);
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
