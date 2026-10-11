import { Component, lazy, Suspense, type ReactNode } from "react";
import { Button, PageHeading, Panel, StateBlock } from "../shared/ui";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../shared/locale";

const Overview = lazy(() => import("../features/overview/screens").then(module => ({ default: module.Overview })));
const EndpointKeys = lazy(() => import("../features/gateway/screens").then(module => ({ default: module.EndpointKeys })));
const Routing = lazy(() => import("../features/gateway/screens").then(module => ({ default: module.Routing })));
const TokenSaver = lazy(() => import("../features/gateway/token-saver").then(module => ({ default: module.TokenSaver })));
const ComboCreate = lazy(() => import("../features/gateway/combo-create").then(module => ({ default: module.ComboCreate })));
const MediaProviders = lazy(() => import("../features/providers/media-dashboard").then(module => ({ default: module.MediaProviders })));
const Connections = lazy(() => import("../features/providers/screens").then(module => ({ default: module.Connections })));
const LlmProviders = lazy(() => import("../features/providers/screens").then(module => ({ default: module.LlmProviders })));
const ProviderDetail = lazy(() => import("../features/providers/screens").then(module => ({ default: module.ProviderDetail })));
const Quota = lazy(() => import("../features/providers/quota").then(module => ({ default: module.Quota })));
const Console = lazy(() => import("../features/traffic/screens").then(module => ({ default: module.Console })));
const RequestDetail = lazy(() => import("../features/traffic/requests").then(module => ({ default: module.RequestDetail })));
const Requests = lazy(() => import("../features/traffic/requests").then(module => ({ default: module.Requests })));
const Usage = lazy(() => import("../features/traffic/usage").then(module => ({ default: module.Usage })));
const DeployWizard = lazy(() => import("../features/network/proxy-pools").then(module => ({ default: module.DeployWizard })));
const ProxyPools = lazy(() => import("../features/network/proxy-pools").then(module => ({ default: module.ProxyPools })));
const Mitm = lazy(() => import("../features/network/screens").then(module => ({ default: module.Mitm })));
const Tunnel = lazy(() => import("../features/network/screens").then(module => ({ default: module.Tunnel })));
const Skills = lazy(() => import("../features/integrations/skills-mcp").then(module => ({ default: module.Skills })));
const Mcp = lazy(() => import("../features/integrations/skills-mcp").then(module => ({ default: module.Mcp })));
const CliTools = lazy(() => import("../features/integrations/cli-core").then(module => ({ default: module.CliTools })));
const CliToolDetail = lazy(() => import("../features/integrations/cli-core").then(module => ({ default: module.CliToolDetail })));
const ClaudeToolDetail = lazy(() => import("../features/integrations/cli-core").then(module => ({ default: module.ClaudeToolDetail })));
const OpenCodeToolDetail = lazy(() => import("../features/integrations/cli-core").then(module => ({ default: module.OpenCodeToolDetail })));
const ClineToolDetail = lazy(() => import("../features/integrations/cli-core").then(module => ({ default: module.ClineToolDetail })));
const DroidToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.DroidToolDetail })));
const CopilotToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.CopilotToolDetail })));
const ManagedJsonToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.ManagedJsonToolDetail })));
const ManagedTomlToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.ManagedTomlToolDetail })));
const KiloToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.KiloToolDetail })));
const HermesToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.HermesToolDetail })));
const JcodeToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.JcodeToolDetail })));
const OmpToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.OmpToolDetail })));
const GrokBuildToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.GrokBuildToolDetail })));
const OpenClawToolDetail = lazy(() => import("../features/integrations/cli-secondary").then(module => ({ default: module.OpenClawToolDetail })));
const Callback = lazy(() => import("../features/settings/screens").then(module => ({ default: module.Callback })));
const Login = lazy(() => import("../features/settings/screens").then(module => ({ default: module.Login })));
const Onboarding = lazy(() => import("../features/settings/screens").then(module => ({ default: module.Onboarding })));
const SettingsAuth = lazy(() => import("../features/settings/screens").then(module => ({ default: module.SettingsAuth })));
const SettingsDeveloper = lazy(() => import("../features/settings/screens").then(module => ({ default: module.SettingsDeveloper })));
const SettingsGeneral = lazy(() => import("../features/settings/general").then(module => ({ default: module.SettingsGeneral })));

class ScreenLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <ScreenLoadFailure /> : this.props.children; }
}

function ScreenLoadFailure() {
  const { t } = useLocale();
  return <div className="state-block error"><code>UI_LOAD_FAILED</code><strong>{t("shell.screenLoadFailed")}</strong>
    <p>{t("shell.screenLoadHint")}</p><Button onClick={() => window.location.reload()}>{t("shell.reloadPage")}</Button></div>;
}

function ConsoleGate() {
  const { t } = useLocale();
  return <><PageHeading eyebrow={t("nav.traffic")} title={t("console.gateTitle")} description={t("console.gateDescription")} /><StateBlock state="empty" action={<Link to="/settings/developer" className="button button-primary">{t("console.developerSettings")}</Link>} /></>;
}

interface ScreenViewProps {
  path: string; developerMode: boolean; onDeveloperMode: (enabled: boolean) => void;
  theme: string; onTheme: (theme: string) => void;
  state?: "ready" | "loading" | "empty" | "error";
}

export function ScreenView(props: ScreenViewProps) {
  const { path, state = "ready" } = props;
  if (state !== "ready") return <><PageHeading eyebrow="UI state preview" title={path === "/" ? "Overview" : path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Screen"}
    description="Visual state for this screen; data binding is pending." />
    <Panel title={state === "loading" ? "Loading data" : state === "empty" ? "No data yet" : "Gateway unavailable"}>
      <StateBlock state={state} code="ERR_GATEWAY_UNAVAILABLE" action={state === "error" ? <Button onClick={() => {
        const url = new URL(window.location.href); url.searchParams.delete("uiState"); window.location.assign(url.href);
      }}>Retry</Button> : state === "empty" ? <Link to="/providers/connections" className="button button-primary">Add connection</Link> : undefined} />
    </Panel></>;
  return <ScreenLoadBoundary key={path}><Suspense fallback={<StateBlock state="loading" />}><ReadyScreen {...props} /></Suspense></ScreenLoadBoundary>;
}

function ReadyScreen({ path, developerMode, onDeveloperMode, theme, onTheme }: ScreenViewProps) {
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
    case "/traffic/console": return developerMode ? <Console /> : <ConsoleGate />;
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
