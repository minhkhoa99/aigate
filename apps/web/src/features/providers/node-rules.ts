import type { ProviderNode } from "./api";

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
