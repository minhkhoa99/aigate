import { Controller, Get, Header } from "@nestjs/common";
import { builtinRegistry } from "@aigate/engine";
import { ConnectionsRepository } from "../../connections/infrastructure/connections.repo.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { CapacityPoolsRepository } from "./capacity-pools.repo.js";
import { CombosRepository } from "./combos.repo.js";

// Local configuration snapshot. A route is not a model-specific eligibility or provider-health claim.
@Controller("api/routing")
export class RoutingStatusController {
  constructor(
    private readonly connections: ConnectionsRepository,
    private readonly settings: SettingsRepository,
    private readonly combos: CombosRepository,
    private readonly pools: CapacityPoolsRepository,
  ) {}

  @Get("status")
  @Header("Cache-Control", "no-store")
  async status() {
    const observedAt = new Date();
    const [settings, accounts, locks, combos, pools] = await Promise.all([
      this.settings.get(), this.connections.routingProviderCounts(), this.connections.routingActiveLocks(observedAt),
      this.combos.list(), this.pools.list(),
    ]);
    const routes = new Map<string, { provider: string; activeAccounts: number; kind: "account" | "keyless" }>(
      accounts.rows.map(row => [row.provider, { ...row, kind: "account" }]),
    );
    // The live chat lane also includes every built-in keyless provider in its active set.
    for (const provider of builtinRegistry.providers) {
      if (provider.auth.kind === "none" && !routes.has(provider.id)) routes.set(provider.id, { provider: provider.id, activeAccounts: 0, kind: "keyless" });
    }
    const ordered = [...routes.values()].sort((a, b) => a.provider.localeCompare(b.provider));
    return {
      observedAt: observedAt.toISOString(), fallbackStrategy: settings.fallbackStrategy,
      comboStickyLimit: settings.comboStickyLimit, comboCount: combos.length,
      enabledPoolCount: pools.filter(pool => pool.enabled).length,
      routes: ordered.slice(0, 100), routesTruncated: accounts.truncated || ordered.length > 100,
      locks: locks.rows.map(lock => ({ ...lock, until: lock.until.toISOString() })), locksTruncated: locks.truncated,
    };
  }
}
