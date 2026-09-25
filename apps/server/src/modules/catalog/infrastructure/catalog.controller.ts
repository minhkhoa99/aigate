import { Controller, Get, Header, NotFoundException, Param } from "@nestjs/common";
import { builtinRegistry, CATALOG, type CatalogProvider } from "@aigate/engine";

// docs/contracts/catalog-providers.md. The whole catalog for the dashboard, with each provider's
// connectable status. Protected by the global dashboard guard. Static data: read from memory only.

interface ProviderSummary {
  id: string;
  name: string;
  category: string;
  protocol: string;
  authKinds: readonly string[];
  hidden: boolean;
  connectable: boolean;
  reason: string | null;
  modelCount: number;
}

function summary(provider: CatalogProvider): ProviderSummary {
  const status = builtinRegistry.status(provider.id);
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    protocol: provider.protocol,
    authKinds: provider.auth.kinds,
    hidden: provider.hidden,
    connectable: status?.connectable ?? false,
    reason: status && !status.connectable ? status.reason : null,
    modelCount: provider.models.length,
  };
}

@Controller("api/providers")
export class CatalogController {
  @Get()
  @Header("Cache-Control", "no-store")
  list(): ProviderSummary[] {
    return CATALOG.map(summary);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  detail(@Param("id") id: string) {
    const provider = CATALOG.find((p) => p.id === id);
    if (!provider) throw new NotFoundException({ code: "NOT_FOUND", message: `No provider "${id}" in the catalog` });
    // The runtime view of the models (limits sanitized) when the provider is connectable; the catalog's otherwise.
    const runtime = builtinRegistry.provider(provider.id);
    const models = (runtime?.models ?? provider.models).map((m) => ({
      id: m.id, name: m.name, kind: m.kind === "llm" ? "chat" : m.kind, capabilities: m.capabilities, contextWindow: m.contextWindow, maxOutputTokens: m.maxOutputTokens,
    }));
    return { ...summary(provider), chatUrl: provider.chatUrl, models };
  }
}
