import { Overview } from "../features/overview/screens";
import { EndpointKeys, Routing, TokenSaver } from "../features/gateway/screens";
import { Connections, LlmProviders, MediaProviders, ProviderDetail, Quota } from "../features/providers/screens";
import { Console, RequestDetail, Requests, Usage } from "../features/traffic/screens";
import { DeployWizard, Mitm, ProxyPools, Tunnel } from "../features/network/screens";
import { CliToolDetail, CliTools, Mcp, Skills } from "../features/integrations/screens";
import { Callback, Login, Onboarding, SettingsAuth, SettingsDeveloper, SettingsGeneral } from "../features/settings/screens";
import { Button, PageHeading, Panel, StateBlock } from "../shared/ui";
import { Link } from "@tanstack/react-router";

export function ScreenView({ path, developerMode, onDeveloperMode, state = "ready" }: {
  path: string; developerMode: boolean; onDeveloperMode: (enabled: boolean) => void;
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
    case "/gateway/token-saver": return <TokenSaver />;
    case "/providers": return <LlmProviders />;
    case "/providers/new": return <ProviderDetail isNew />;
    case "/providers/anthropic": return <ProviderDetail />;
    case "/providers/connections": return <Connections />;
    case "/providers/quota": return <Quota />;
    case "/providers/media": return <MediaProviders />;
    case "/providers/media/video": return <MediaProviders detail />;
    case "/providers/media/video/xai": return <MediaProviders detail />;
    case "/traffic/usage": return <Usage />;
    case "/traffic/requests": return <Requests />;
    case "/traffic/requests/request-123": return <RequestDetail />;
    case "/traffic/console": return developerMode ? <Console /> : <><PageHeading eyebrow="Traffic" title="Developer mode required" description="Enable developer mode in Settings to inspect console events." /><StateBlock state="empty" action={<Link to="/settings/developer" className="button button-primary">Open developer settings</Link>} /></>;
    case "/network/proxy-pools": return <ProxyPools />;
    case "/network/proxy-pools/deploy": return <DeployWizard />;
    case "/network/tunnel": return <Tunnel />;
    case "/network/mitm": return <Mitm />;
    case "/integrations/cli-tools": return <CliTools />;
    case "/integrations/cli-tools/codex": return <CliToolDetail />;
    case "/integrations/skills": return <Skills />;
    case "/integrations/mcp": return <Mcp />;
    case "/settings/general": return <SettingsGeneral />;
    case "/settings/auth": return <SettingsAuth />;
    case "/settings/developer": return <SettingsDeveloper enabled={developerMode} onChange={onDeveloperMode} />;
    case "/login": return <Login />;
    case "/callback": return <Callback />;
    case "/welcome": return <Onboarding />;
    default: return <><PageHeading eyebrow="Navigation" title="Page not found" description="This route is not part of the UI preview." /><StateBlock state="error" code="ERR_ROUTE_NOT_FOUND" action={<Link to="/" className="button button-primary">Back to overview</Link>} /></>;
  }
}
