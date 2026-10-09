import { Overview } from "../features/overview/screens";
import { EndpointKeys, Routing } from "../features/gateway/screens";
import { TokenSaver } from "../features/gateway/token-saver";
import { ComboCreate } from "../features/gateway/combo-create";
import { MediaProviders } from "../features/providers/media-dashboard";
import { Connections, LlmProviders, ProviderDetail, Quota } from "../features/providers/screens";
import { Console, RequestDetail, Requests, Usage } from "../features/traffic/screens";
import { DeployWizard, Mitm, ProxyPools, Tunnel } from "../features/network/screens";
import { ClaudeToolDetail, ClineToolDetail, CliToolDetail, CliTools, CopilotToolDetail, DroidToolDetail, GrokBuildToolDetail, HermesToolDetail, JcodeToolDetail, KiloToolDetail, ManagedJsonToolDetail, ManagedTomlToolDetail, Mcp, OmpToolDetail, OpenClawToolDetail, OpenCodeToolDetail, Skills } from "../features/integrations/screens";
import { Callback, Login, Onboarding, SettingsAuth, SettingsDeveloper, SettingsGeneral } from "../features/settings/screens";
import { Button, PageHeading, Panel, StateBlock } from "../shared/ui";
import { Link } from "@tanstack/react-router";

export function ScreenView({ path, developerMode, onDeveloperMode, theme, onTheme, state = "ready" }: {
  path: string; developerMode: boolean; onDeveloperMode: (enabled: boolean) => void;
  theme: string; onTheme: (theme: string) => void;
  state?: "ready" | "loading" | "empty" | "error";
}) {
  if (state !== "ready") return <><PageHeading eyebrow="UI state preview" title={path === "/" ? "Overview" : path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Screen"}
    description="Visual state for this screen; data binding is pending." />
    <Panel title={state === "loading" ? "Loading data" : state === "empty" ? "No data yet" : "Gateway unavailable"}>
      <StateBlock state={state} code="ERR_GATEWAY_UNAVAILABLE" action={state === "error" ? <Button onClick={() => {
        const url = new URL(window.location.href); url.searchParams.delete("uiState"); window.location.assign(url.href);
      }}>Retry</Button> : state === "empty" ? <Link to="/providers/connections" className="button button-primary">Add connection</Link> : undefined} />
    </Panel></>;
  switch (path) {
    case "/": return <Overview />;
    case "/gateway/endpoint": return <EndpointKeys />;
    case "/gateway/routing": return <Routing />;
    case "/gateway/routing/new": return <ComboCreate />;
    case "/gateway/token-saver": return <TokenSaver />;
    case "/providers": return <LlmProviders />;
    case "/providers/new": return <ProviderDetail isNew />;
    case "/providers/detail": return <ProviderDetail providerId={new URLSearchParams(window.location.search).get("provider") ?? undefined} />;
    case "/providers/connections": return <Connections />;
    case "/providers/quota": return <Quota />;
    case "/providers/media": return <MediaProviders />;
    case "/providers/media/catalog": return <MediaProviders kind={new URLSearchParams(window.location.search).get("kind") ?? undefined} />;
    case "/providers/media/provider": return <MediaProviders kind={new URLSearchParams(window.location.search).get("kind") ?? undefined} providerId={new URLSearchParams(window.location.search).get("provider") ?? undefined} />;
    case "/providers/media/video": return <MediaProviders kind="video" />;
    case "/providers/media/video/xai": return <MediaProviders kind="video" providerId="xai" />;
    case "/traffic/usage": return <Usage />;
    case "/traffic/requests": return <Requests />;
    case "/traffic/requests/detail": return <RequestDetail requestId={new URLSearchParams(window.location.search).get("id") ?? ""} />;
    case "/traffic/console": return developerMode ? <Console /> : <><PageHeading eyebrow="Traffic" title="Developer mode required" description="Enable developer mode in Settings to inspect console events." /><StateBlock state="empty" action={<Link to="/settings/developer" className="button button-primary">Open developer settings</Link>} /></>;
    case "/network/proxy-pools": return <ProxyPools />;
    case "/network/proxy-pools/deploy": return <DeployWizard />;
    case "/network/tunnel": return <Tunnel />;
    case "/network/mitm": return <Mitm />;
    case "/integrations/cli-tools": return <CliTools />;
    case "/integrations/cli-tools/codex": return <CliToolDetail />;
    case "/integrations/cli-tools/claude": return <ClaudeToolDetail />;
    case "/integrations/cli-tools/opencode": return <OpenCodeToolDetail />;
    case "/integrations/cli-tools/cline": return <ClineToolDetail />;
    case "/integrations/cli-tools/droid": return <DroidToolDetail />;
    case "/integrations/cli-tools/copilot": return <CopilotToolDetail />;
    case "/integrations/cli-tools/crush": return <ManagedJsonToolDetail tool="crush" title="Crush" />;
    case "/integrations/cli-tools/pi": return <ManagedJsonToolDetail tool="pi" title="Pi" />;
    case "/integrations/cli-tools/smelt": return <ManagedJsonToolDetail tool="smelt" title="Smelt" />;
    case "/integrations/cli-tools/codewhale": return <ManagedTomlToolDetail tool="codewhale" title="CodeWhale" />;
    case "/integrations/cli-tools/forge": return <ManagedTomlToolDetail tool="forge" title="Forge" />;
    case "/integrations/cli-tools/kilo": return <KiloToolDetail />;
    case "/integrations/cli-tools/deepseek-tui": return <ManagedTomlToolDetail tool="deepseek-tui" title="DeepSeek TUI" />;
    case "/integrations/cli-tools/hermes": return <HermesToolDetail />;
    case "/integrations/cli-tools/jcode": return <JcodeToolDetail />;
    case "/integrations/cli-tools/omp": return <OmpToolDetail />;
    case "/integrations/cli-tools/grok-build": return <GrokBuildToolDetail />;
    case "/integrations/cli-tools/openclaw": return <OpenClawToolDetail />;
    case "/integrations/skills": return <Skills />;
    case "/integrations/mcp": return <Mcp />;
    case "/settings/general": return <SettingsGeneral theme={theme} onTheme={onTheme} />;
    case "/settings/auth": return <SettingsAuth />;
    case "/settings/developer": return <SettingsDeveloper enabled={developerMode} onChange={onDeveloperMode} />;
    case "/login": return <Login />;
    case "/callback": return <Callback />;
    case "/welcome": return <Onboarding />;
    default: return path.startsWith("/providers/") ? <ProviderDetail providerId={path.split("/")[2]} /> : <><PageHeading eyebrow="Navigation" title="Page not found" description="This route is not part of the UI preview." /><StateBlock state="error" code="ERR_ROUTE_NOT_FOUND" action={<Link to="/" className="button button-primary">Back to overview</Link>} /></>;
  }
}
