export const navigation = [
  { group: "Overview", items: [{ label: "Overview", href: "/", icon: "▣" }] },
  { group: "Gateway", items: [
    { label: "Endpoint & Keys", href: "/gateway/endpoint", icon: "◇" },
    { label: "Routing & Fallback", href: "/gateway/routing", icon: "↬" },
    { label: "Token Saver", href: "/gateway/token-saver", icon: "◈" },
  ] },
  { group: "Providers", items: [
    { label: "LLM Providers", href: "/providers", icon: "▤" },
    { label: "Media Providers", href: "/providers/media", icon: "▧" },
    { label: "Connections", href: "/providers/connections", icon: "⌁" },
    { label: "Quota", href: "/providers/quota", icon: "◔" },
  ] },
  { group: "Traffic", items: [
    { label: "Usage", href: "/traffic/usage", icon: "▥" },
    { label: "Requests", href: "/traffic/requests", icon: "≡" },
    { label: "Console", href: "/traffic/console", icon: "▢", devOnly: true },
  ] },
  { group: "Network", items: [
    { label: "Proxy Pools", href: "/network/proxy-pools", icon: "⇄" },
    { label: "Tunnel", href: "/network/tunnel", icon: "◉" },
    { label: "MITM", href: "/network/mitm", icon: "⬡" },
  ] },
  { group: "Integrations", items: [
    { label: "CLI Tools", href: "/integrations/cli-tools", icon: "▦" },
    { label: "Skills", href: "/integrations/skills", icon: "✧" },
    { label: "MCP", href: "/integrations/mcp", icon: "⌘" },
  ] },
  { group: "Settings", items: [
    { label: "General", href: "/settings/general", icon: "⚙" },
    { label: "Auth & Access", href: "/settings/auth", icon: "♧" },
    { label: "Developer", href: "/settings/developer", icon: "⌥" },
  ] },
] as const;

export const extraRoutes = [
  "/gateway/routing/new",
  "/providers/new", "/providers/detail", "/providers/media/catalog", "/providers/media/provider", "/providers/media/video", "/providers/media/video/xai",
  "/traffic/requests/detail", "/integrations/cli-tools/codex", "/integrations/cli-tools/claude", "/integrations/cli-tools/opencode", "/integrations/cli-tools/cline", "/integrations/cli-tools/droid", "/integrations/cli-tools/copilot", "/integrations/cli-tools/crush", "/integrations/cli-tools/pi", "/integrations/cli-tools/smelt", "/integrations/cli-tools/codewhale", "/integrations/cli-tools/forge", "/integrations/cli-tools/kilo", "/integrations/cli-tools/openclaw", "/integrations/cli-tools/deepseek-tui", "/integrations/cli-tools/hermes", "/integrations/cli-tools/jcode", "/integrations/cli-tools/omp", "/integrations/cli-tools/grok-build", "/network/proxy-pools/deploy",
  "/welcome", "/login", "/callback",
] as const;
