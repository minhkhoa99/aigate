// Pure helpers for the Usage page (docs/contracts/usage.md "UI"); tested in usage-format.test.mjs.

export const SERIES_SLOTS = 5;
export const OTHER = "__other__";

export const formatTokens = (value: number, locale = "en-US"): string => (value < 1000 ? String(Math.round(value)) : new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value));

// Small costs keep four decimals, so a cent-level request does not read as $0.00.
export function formatCost(value: number, locale = "en-US"): string {
  const digits = value !== 0 && Math.abs(value) < 0.01 ? 4 : 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export const errorRate = (errors: number, requests: number, locale = "en-US"): string => (requests === 0 ? "—" : new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: errors === 0 ? 0 : 1, maximumFractionDigits: errors === 0 ? 0 : 1 }).format(errors / requests));

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
export function bucketLabel(start: number, bucket: "hour" | "day", timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, bucket === "hour" ? { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { timeZone, month: "short", day: "numeric" }).format(start);
}
