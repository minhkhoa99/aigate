export interface AccountCandidate {
  id: string;
  priority: number;
  lastUsedAt: Date | null;
  consecutiveUseCount: number;
}

// multi-account.md: eligible rows arrive in priority order; choice itself never writes.
export function chooseAccount<T extends AccountCandidate>(available: readonly T[], strategy: "fill-first" | "round-robin"):
  { account: T; nextUseCount: number | null } | undefined {
  if (!available.length) return undefined;
  if (strategy === "fill-first") return { account: available[0], nextUseCount: null };
  const recent = [...available].sort((a, b) => (b.lastUsedAt?.getTime() ?? -1) - (a.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
  const account = recent.lastUsedAt && recent.consecutiveUseCount < 3 ? recent
    : [...available].sort((a, b) => (a.lastUsedAt?.getTime() ?? -1) - (b.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
  return { account, nextUseCount: account.id === recent.id && recent.lastUsedAt ? recent.consecutiveUseCount + 1 : 1 };
}
