import { Link } from "@tanstack/react-router";
import { Button, CopyField, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { mediaGroups } from "./catalog";
import { useConnections, useProviders, type Connection, type ProviderSummary } from "./api";
import { mediaAvailability, providersForMediaKind } from "./media-rules";
import { statusPill } from "./test-result";
import { VoiceBrowser } from "./voice-browser";
import { useLocale } from "../../shared/locale";
import type { MessageKey } from "../../shared/i18n";

const kindKeys: Record<(typeof mediaGroups)[number]["id"], MessageKey> = {
  embedding: "media.kind.embedding", image: "media.kind.image", imageToText: "media.kind.imageToText",
  tts: "media.kind.tts", stt: "media.kind.stt", webSearch: "media.kind.webSearch",
  webFetch: "media.kind.webFetch", video: "media.kind.video", music: "media.kind.music",
};
const testKeys: Record<Connection["testStatus"], MessageKey> = {
  untested: "media.test.untested", active: "media.test.active", invalid: "media.test.invalid",
  no_quota: "media.test.no_quota", unreachable: "media.test.unreachable",
};

const kindLink = (kind: string) => `/providers/media/catalog?kind=${encodeURIComponent(kind)}`;
const providerLink = (kind: string, provider: string) => `/providers/media/provider?kind=${encodeURIComponent(kind)}&provider=${encodeURIComponent(provider)}`;

function MediaTabs({ catalog, connections, active }: { catalog: ProviderSummary[]; connections: Connection[]; active: string }) {
  const { t } = useLocale();
  return <nav className="tabs media-tabs" aria-label={t("media.navKinds")}>{mediaGroups.map(kind => {
    const configured = providersForMediaKind(catalog, kind.id).some(provider => mediaAvailability(provider, kind.id, connections).configured);
    return <a key={kind.id} className={`${kind.id === active ? "active" : ""}${configured ? "" : " unconfigured"}`} aria-current={kind.id === active ? "page" : undefined} href={kindLink(kind.id)}>
      {t(kindKeys[kind.id])}{!configured && <small>{t("media.notConfigured")}</small>}
    </a>;
  })}</nav>;
}

function MediaProviderDetail({ kind, provider, connections, peers }: { kind: (typeof mediaGroups)[number]; provider: ProviderSummary; connections: Connection[]; peers: ProviderSummary[] }) {
  const { t } = useLocale();
  const state = mediaAvailability(provider, kind.id, connections);
  const kindName = t(kindKeys[kind.id]);
  return <>
    <PageHeading eyebrow={t("media.kindEyebrow", { kind: kindName })} title={provider.name} description={t("media.catalogProvider", { kind: kindName, id: provider.id })}
      action={state.route && provider.connectable ? <a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>+ {t("media.addConnection")}</a> : undefined} />
    <div className="split">
      <Panel title={t("media.routeAccounts")}>
        {!state.route ? <Warning>{t("media.noRouteProvider", { kind: kindName })} {provider.reason}</Warning>
          : !provider.connectable ? <Warning>{provider.reason ?? t("media.cannotConnect")}</Warning>
            : state.saved.length === 0 ? <div className="state-block"><strong>{t("media.ready")}</strong><p>{t("media.addAccountHint")}</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>{t("media.addConnection")}</a></div>
              : <><p className="muted">{t("media.accountSummary", { active: state.active.length, saved: state.saved.length })}</p>
                <Table columns={[t("media.account"), t("media.status"), t("media.priority"), t("media.action")]} rows={state.saved.map(account => {
                  const pill = statusPill(account);
                  return [<span><strong>{account.name}</strong>{account.lastError && <small className="media-account-error">{account.lastError}</small>}</span>,
                    <Pill tone={pill.tone}>{t(account.isActive ? testKeys[account.testStatus] : "media.test.disabled")}</Pill>, account.priority, <Link to="/providers/connections" className="button button-ghost">{t("media.manage")}</Link>];
                })} /></>}
      </Panel>
      <Panel title={t("media.endpoint")}>{state.route && kind.endpoint
        ? <CopyField label={`POST ${kind.endpoint}`} value={`${window.location.origin}${kind.endpoint}`} />
        : <p className="muted">{t("media.noEndpointProvider")}</p>}</Panel>
    </div>
    {kind.id === "tts" && <VoiceBrowser providers={peers} connections={connections} initialProvider={provider.id} />}
  </>;
}

export function MediaProviders({ kind, providerId }: { kind?: string; providerId?: string }) {
  const { language, t } = useLocale();
  const catalog = useProviders();
  const connections = useConnections();
  const group = mediaGroups.find(item => item.id === kind);
  if ((kind && !group) || (providerId && !group)) return <><PageHeading eyebrow={t("media.eyebrow")} title={t("media.kindNotFound")} description={t("media.kindNotFoundHint")} /><Link to="/providers/media" className="button">{t("media.backRoot")}</Link></>;
  if (catalog.isPending || connections.isPending) return <StateBlock state="loading" />;
  if (catalog.isError || connections.isError) {
    const problem = toProblem(catalog.error ?? connections.error, language);
    return <><StateBlock state="error" code={problem.code} action={<Button onClick={() => { void catalog.refetch(); void connections.refetch(); }}>{t("common.retry")}</Button>} /><Warning tone="danger">{problem.message}</Warning></>;
  }
  const all = catalog.data, accounts = connections.data;
  if (group) {
    const providers = providersForMediaKind(all, group.id);
    if (providerId) {
      const provider = providers.find(item => item.id === providerId);
      if (!provider) return <><PageHeading eyebrow={t("media.kindEyebrow", { kind: t(kindKeys[group.id]) })} title={t("media.providerNotFound")} description={t("media.providerNotFoundHint")} /><Link to="/providers/media/catalog" search={{ kind: group.id }} className="button">{t("media.backKind", { kind: t(kindKeys[group.id]) })}</Link></>;
      return <MediaProviderDetail kind={group} provider={provider} connections={accounts} peers={providers} />;
    }
    const routes = providers.filter(item => item.routeKinds.includes(group.id));
    const configured = routes.filter(item => mediaAvailability(item, group.id, accounts).configured);
    return <>
      <PageHeading eyebrow={t("media.eyebrow")} title={t("media.kindProviders", { kind: t(kindKeys[group.id]) })} description={t("media.routeSummary", { routes: routes.length, configured: configured.length })} />
      <MediaTabs catalog={all} connections={accounts} active={group.id} />
      <div className="section-gap">{routes.length > 0 && group.endpoint
        ? <CopyField label={t("media.postEndpoint")} value={`${window.location.origin}${group.endpoint}`} />
        : <p className="muted">{t("media.noEndpointKind")}</p>}</div>
      {providers.length === 0 ? <div className="state-block"><strong>{t("media.noProviders")}</strong><p>{t("media.noProvidersHint")}</p></div>
        : <div className="catalog-grid section-gap">{providers.map(provider => {
          const state = mediaAvailability(provider, group.id, accounts);
          const status = !state.route ? t("media.routeUnavailable") : state.active.length ? t("media.enabledAccounts", { count: state.active.length })
            : state.saved.length ? t("media.noEnabledAccount") : provider.connectable ? t("media.ready") : provider.reason ?? t("media.notConnectable");
          return <a className="catalog-card" href={providerLink(group.id, provider.id)} key={provider.id}><span className="catalog-glyph" aria-hidden="true">{provider.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{provider.name}</strong><small>{status}</small></span></a>;
        })}</div>}
      {group.id === "tts" && providers.length > 0 && <VoiceBrowser providers={providers} connections={accounts} />}
    </>;
  }
  return <>
    <PageHeading eyebrow={t("media.eyebrow")} title={t("media.rootTitle")} description={t("media.rootHint")} />
    <div className="grid grid-3">{mediaGroups.map(item => {
      const providers = providersForMediaKind(all, item.id);
      const routes = providers.filter(provider => provider.routeKinds.includes(item.id));
      const configured = routes.filter(provider => mediaAvailability(provider, item.id, accounts).configured);
      const title = t(kindKeys[item.id]);
      return <a href={kindLink(item.id)} className="media-card" key={item.id}><div className="row between"><span className="media-icon">{title.slice(0, 1)}</span><Pill tone={configured.length ? "healthy" : routes.length ? "info" : "muted"}>{configured.length ? t("media.configuredCount", { count: configured.length }) : t("media.notConfigured")}</Pill></div>
        <strong>{title}</strong><small>{t("media.cardCounts", { routes: routes.length, providers: providers.length })}</small></a>;
    })}</div>
  </>;
}
