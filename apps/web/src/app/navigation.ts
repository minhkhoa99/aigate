export const navigation = [
  { group: "Overview", groupKey: "nav.overview", items: [{ label: "Overview", labelKey: "nav.overview", href: "/", icon: "▣" }] },
  { group: "Gateway", groupKey: "nav.gateway", items: [
    { label: "Endpoint & Keys", labelKey: "nav.endpoint", href: "/gateway/endpoint", icon: "◇" },
    { label: "Routing & Fallback", labelKey: "nav.routing", href: "/gateway/routing", icon: "↬" },
    { label: "Token Saver", labelKey: "nav.tokenSaver", href: "/gateway/token-saver", icon: "◈" },
  ] },
  { group: "Providers", groupKey: "nav.providers", items: [
    { label: "LLM Providers", labelKey: "nav.llm", href: "/providers", icon: "▤" },
    { label: "Media Providers", labelKey: "nav.media", href: "/providers/media", icon: "▧" },
    { label: "Connections", labelKey: "nav.connections", href: "/providers/connections", icon: "⌁" },
    { label: "Quota", labelKey: "nav.quota", href: "/providers/quota", icon: "◔" },
  ] },
  { group: "Traffic", groupKey: "nav.traffic", items: [
    { label: "Usage", labelKey: "nav.usage", href: "/traffic/usage", icon: "▥" },
    { label: "Requests", labelKey: "nav.requests", href: "/traffic/requests", icon: "≡" },
    { label: "Console", labelKey: "nav.console", href: "/traffic/console", icon: "▢", devOnly: true },
  ] },
  { group: "Network", groupKey: "nav.network", items: [
    { label: "Proxy Pools", labelKey: "nav.proxy", href: "/network/proxy-pools", icon: "⇄" },
    { label: "Tunnel", labelKey: "nav.tunnel", href: "/network/tunnel", icon: "◉" },
    { label: "MITM", labelKey: "nav.mitm", href: "/network/mitm", icon: "⬡" },
  ] },
  { group: "Integrations", groupKey: "nav.integrations", items: [
    { label: "CLI Tools", labelKey: "nav.cli", href: "/integrations/cli-tools", icon: "▦" },
    { label: "Skills", labelKey: "nav.skills", href: "/integrations/skills", icon: "✧" },
    { label: "MCP", labelKey: "nav.mcp", href: "/integrations/mcp", icon: "⌘" },
  ] },
  { group: "Settings", groupKey: "nav.settings", items: [
    { label: "General", labelKey: "nav.general", href: "/settings/general", icon: "⚙" },
    { label: "Auth & Access", labelKey: "nav.auth", href: "/settings/auth", icon: "♧" },
    { label: "Developer", labelKey: "nav.developer", href: "/settings/developer", icon: "⌥" },
  ] },
] as const;

export const extraRoutes = [
  "/gateway/routing/new",
  "/providers/new", "/providers/detail", "/providers/media/catalog", "/providers/media/provider", "/providers/media/video", "/providers/media/video/xai",
  "/traffic/requests/detail", "/integrations/cli-tools/codex", "/integrations/cli-tools/claude", "/integrations/cli-tools/opencode", "/integrations/cli-tools/cline", "/integrations/cli-tools/droid", "/integrations/cli-tools/copilot", "/integrations/cli-tools/crush", "/integrations/cli-tools/pi", "/integrations/cli-tools/smelt", "/integrations/cli-tools/codewhale", "/integrations/cli-tools/forge", "/integrations/cli-tools/kilo", "/integrations/cli-tools/openclaw", "/integrations/cli-tools/deepseek-tui", "/integrations/cli-tools/hermes", "/integrations/cli-tools/jcode", "/integrations/cli-tools/omp", "/integrations/cli-tools/grok-build", "/network/proxy-pools/deploy",
  "/welcome", "/login", "/callback",
] as const;
