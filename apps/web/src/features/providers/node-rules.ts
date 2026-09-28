import type { HeaderInput, ProviderNode } from "./api";

// One custom header row of the form; hint is set for a header already saved.
export interface HeaderRow { id: number; name: string; value: string; hint?: string }

// The headers to save: blank rows are dropped; an empty value keeps the saved one (the server refuses it for a new name).
export function headerPayload(rows: readonly HeaderRow[]): HeaderInput[] {
  return rows.flatMap((row) => {
    const name = row.name.trim();
    if (name === "") return [];
    return row.value === "" ? [{ name }] : [{ name, value: row.value }];
  });
}

// Why /v1 can never reach a custom provider (docs/contracts/custom-providers.md). The server stores these as
// 9router does (connection.provider-node-create-list, connection.anthropic-compatible-node).
export function unreachable(node: ProviderNode, all: readonly ProviderNode[], reserved: ReadonlySet<string>): string | null {
  if (node.prefix.includes("/")) return `The prefix contains "/", so "<prefix>/<model>" can never match it.`;
  if (reserved.has(node.prefix)) return `"${node.prefix}" is a built-in provider id or alias, which always wins.`;
  // As in 9router: OpenAI-compatible providers are matched first, then the oldest (the list is oldest first).
  const winner = all.find((n) => n.prefix === node.prefix && n.type === "openai-compatible") ?? all.find((n) => n.prefix === node.prefix);
  if (!winner || winner.id === node.id) return null;
  return winner.type === node.type ? `${winner.name} has the same prefix and was added first, so it wins.` : `${winner.name} has the same prefix and wins: OpenAI compatible providers are matched first.`;
}
