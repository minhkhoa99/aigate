import { Link } from "@tanstack/react-router";
import { Button, CopyField, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { mediaGroups } from "./catalog";
import { useConnections, useProviders, type Connection, type ProviderSummary } from "./api";
import { mediaAvailability, providersForMediaKind } from "./media-rules";
import { statusPill } from "./test-result";
import { VoiceBrowser } from "./voice-browser";

const kindLink = (kind: string) => `/providers/media/catalog?kind=${encodeURIComponent(kind)}`;
const providerLink = (kind: string, provider: string) => `/providers/media/provider?kind=${encodeURIComponent(kind)}&provider=${encodeURIComponent(provider)}`;

function MediaTabs({ catalog, connections, active }: { catalog: ProviderSummary[]; connections: Connection[]; active: string }) {
  return <nav className="tabs media-tabs" aria-label="Media kinds">{mediaGroups.map(kind => {
    const configured = providersForMediaKind(catalog, kind.id).some(provider => mediaAvailability(provider, kind.id, connections).configured);
    return <a key={kind.id} className={`${kind.id === active ? "active" : ""}${configured ? "" : " unconfigured"}`} aria-current={kind.id === active ? "page" : undefined} href={kindLink(kind.id)}>
      {kind.title}{!configured && <small>Not configured</small>}
    </a>;
  })}</nav>;
}

function MediaProviderDetail({ kind, provider, connections, peers }: { kind: (typeof mediaGroups)[number]; provider: ProviderSummary; connections: Connection[]; peers: ProviderSummary[] }) {
  const state = mediaAvailability(provider, kind.id, connections);
  return <>
    <PageHeading eyebrow={`Providers / Media / ${kind.title}`} title={provider.name} description={`Catalog provider for ${kind.title.toLowerCase()} · ID ${provider.id}.`}
      action={state.route && provider.connectable ? <a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>+ Add connection</a> : undefined} />
    <div className="split">
      <Panel title="AIGate route and accounts">
        {!state.route ? <Warning>AIGate has no working {kind.title.toLowerCase()} route for this provider. {provider.reason}</Warning>
          : !provider.connectable ? <Warning>{provider.reason ?? "This provider cannot be connected yet."}</Warning>
            : state.saved.length === 0 ? <div className="state-block"><strong>Ready to connect</strong><p>Add an account before this route can serve requests.</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>Add connection</a></div>
              : <><p className="muted">{state.active.length} enabled of {state.saved.length} saved account{state.saved.length === 1 ? "" : "s"}. A passed test is the latest check, not a live health guarantee.</p>
                <Table columns={["Account", "Status", "Priority", "Action"]} rows={state.saved.map(account => {
                  const pill = statusPill(account);
                  return [<span><strong>{account.name}</strong>{account.lastError && <small className="media-account-error">{account.lastError}</small>}</span>,
                    <Pill tone={pill.tone}>{pill.label}</Pill>, account.priority, <Link to="/providers/connections" className="button button-ghost">Manage</Link>];
                })} /></>}
      </Panel>
      <Panel title="Endpoint">{state.route && kind.endpoint
        ? <CopyField label={`POST ${kind.endpoint}`} value={`${window.location.origin}${kind.endpoint}`} />
        : <p className="muted">No AIGate endpoint is available for this provider and kind.</p>}</Panel>
    </div>
    {kind.id === "tts" && <VoiceBrowser providers={peers} connections={connections} initialProvider={provider.id} />}
  </>;
}

export function MediaProviders({ kind, providerId }: { kind?: string; providerId?: string }) {
  const catalog = useProviders();
  const connections = useConnections();
  const group = mediaGroups.find(item => item.id === kind);
  if ((kind && !group) || (providerId && !group)) return <><PageHeading eyebrow="Providers / Media" title="Media kind not found" description="This capability is not in the current catalog." /><Link to="/providers/media" className="button">Back to media providers</Link></>;
  if (catalog.isPending || connections.isPending) return <StateBlock state="loading" />;
  if (catalog.isError || connections.isError) {
    const problem = toProblem(catalog.error ?? connections.error);
    return <><StateBlock state="error" code={problem.code} action={<Button onClick={() => { void catalog.refetch(); void connections.refetch(); }}>Retry</Button>} /><Warning tone="danger">{problem.message}</Warning></>;
  }
  const all = catalog.data, accounts = connections.data;
  if (group) {
    const providers = providersForMediaKind(all, group.id);
    if (providerId) {
      const provider = providers.find(item => item.id === providerId);
      if (!provider) return <><PageHeading eyebrow={`Providers / Media / ${group.title}`} title="Media provider not found" description="This provider is not listed for the selected media kind." /><Link to="/providers/media/catalog" search={{ kind: group.id }} className="button">Back to {group.title}</Link></>;
      return <MediaProviderDetail kind={group} provider={provider} connections={accounts} peers={providers} />;
    }
    const routes = providers.filter(item => item.routeKinds.includes(group.id));
    const configured = routes.filter(item => mediaAvailability(item, group.id, accounts).configured);
    return <>
      <PageHeading eyebrow="Providers / Media" title={`${group.title} providers`} description={`${routes.length} AIGate route${routes.length === 1 ? "" : "s"}; ${configured.length} with an enabled account.`} />
      <MediaTabs catalog={all} connections={accounts} active={group.id} />
      <div className="section-gap">{routes.length > 0 && group.endpoint
        ? <CopyField label="POST endpoint" value={`${window.location.origin}${group.endpoint}`} />
        : <p className="muted">AIGate has no usable endpoint for this kind yet.</p>}</div>
      {providers.length === 0 ? <div className="state-block"><strong>No providers listed</strong><p>No catalog provider advertises this capability yet.</p></div>
        : <div className="catalog-grid section-gap">{providers.map(provider => {
          const state = mediaAvailability(provider, group.id, accounts);
          const status = !state.route ? "AIGate route unavailable" : state.active.length ? `${state.active.length} enabled account${state.active.length === 1 ? "" : "s"}`
            : state.saved.length ? "No enabled account" : provider.connectable ? "Ready to connect" : provider.reason ?? "Not connectable yet";
          return <a className="catalog-card" href={providerLink(group.id, provider.id)} key={provider.id}><span className="catalog-glyph" aria-hidden="true">{provider.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{provider.name}</strong><small>{status}</small></span></a>;
        })}</div>}
      {group.id === "tts" && providers.length > 0 && <VoiceBrowser providers={providers} connections={accounts} />}
    </>;
  }
  return <>
    <PageHeading eyebrow="Providers / Media" title="Media providers" description="Browse catalog routes and see which media kinds have an enabled provider account." />
    <div className="grid grid-3">{mediaGroups.map(item => {
      const providers = providersForMediaKind(all, item.id);
      const routes = providers.filter(provider => provider.routeKinds.includes(item.id));
      const configured = routes.filter(provider => mediaAvailability(provider, item.id, accounts).configured);
      return <a href={kindLink(item.id)} className="media-card" key={item.id}><div className="row between"><span className="media-icon">{item.title.slice(0, 1)}</span><Pill tone={configured.length ? "healthy" : routes.length ? "info" : "muted"}>{configured.length ? `${configured.length} configured` : "Not configured"}</Pill></div>
        <strong>{item.title}</strong><small>{routes.length} AIGate route{routes.length === 1 ? "" : "s"} · {providers.length} catalog provider{providers.length === 1 ? "" : "s"}</small></a>;
    })}</div>
  </>;
}
