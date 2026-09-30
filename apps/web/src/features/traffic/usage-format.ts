// Pure helpers for the Usage page (docs/contracts/usage.md "UI"); tested in usage-format.test.mjs.

export const SERIES_SLOTS = 5;
export const OTHER = "__other__";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const formatTokens = (value: number): string => (value < 1000 ? String(Math.round(value)) : compact.format(value));

// Small costs keep four decimals, so a cent-level request does not read as $0.00.
export function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const errorRate = (errors: number, requests: number): string => (requests === 0 ? "—" : `${((errors / requests) * 100).toFixed(errors === 0 ? 0 : 1)}%`);

// The providers the chart names: the top five by tokens, the rest folded into Other (never a sixth generated hue).
export function chartSeries(totals: Readonly<Record<string, number>>): { named: string[]; other: boolean } {
  const ranked = Object.entries(totals).filter(([, tokens]) => tokens > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([provider]) => provider);
  return { named: ranked.slice(0, SERIES_SLOTS), other: ranked.length > SERIES_SLOTS };
}

// Color follows the entity: a provider keeps its slot while it stays on screen; a newcomer takes a free slot, or the
// slot of a provider no longer shown. ponytail: the map lives for the page session, not across reloads.
export function assignSlots(previous: ReadonlyMap<string, number>, visible: readonly string[]): Map<string, number> {
  const next = new Map<string, number>();
  for (const provider of visible) {
    const slot = previous.get(provider);
    if (slot !== undefined) next.set(provider, slot);
  }
  const used = new Set(next.values());
  const free = Array.from({ length: SERIES_SLOTS }, (_, slot) => slot).filter((slot) => !used.has(slot));
  for (const provider of visible) if (!next.has(provider)) next.set(provider, free.shift() ?? 0);
  return next;
}

// Bucket labels in the server's usage zone, not the browser's.
export function bucketLabel(start: number, bucket: "hour" | "day", timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", bucket === "hour" ? { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { timeZone, month: "short", day: "numeric" }).format(start);
}
