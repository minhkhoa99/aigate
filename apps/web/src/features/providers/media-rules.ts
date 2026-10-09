import type { Connection, ProviderSummary } from "./api";

// Catalog claims and AIGate routes are separate. Saved but disabled accounts do not configure a route.
export function providersForMediaKind(catalog: readonly ProviderSummary[], kind: string): ProviderSummary[] {
  return catalog.filter(provider => !provider.hidden && provider.serviceKinds.includes(kind));
}

export function mediaAvailability(provider: ProviderSummary, kind: string, connections: readonly Connection[]) {
  const saved = connections.filter(connection => connection.provider === provider.id);
  const active = saved.filter(connection => connection.isActive);
  const route = provider.routeKinds.includes(kind);
  return { route, saved, active, configured: route && active.length > 0 };
}
