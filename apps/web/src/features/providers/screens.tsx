import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { CustomProviderDetail, CustomProviderForm, CustomProviders } from "./custom";
import { ProviderModels } from "./models";
import {
  useConnections, useCreateConnection, useDeleteConnection, useProvider, useProviderNodes, useProviders, useSetThinking, useTestConnection, useUpdateConnection, type Connection,
  type ConnectionField, type ProviderDetailView, type ThinkingLevel,
} from "./api";
import { testNotice, needsAttention, statusPill, STATUS_KEYS } from "./test-result";
import { SignIn } from "./sign-in";
import { useProxyPools } from "../network/api";

const formText = (form: HTMLFormElement, name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
};

// Catalog categories in 9router's page order; "free" (keyless) and "freeTier" share one section there.
interface Group { id: string; titleKey: "providers.oauthTitle" | "providers.freeTitle" | "providers.apiKeyTitle" | "providers.webAccountTitle" | "providers.otherTitle"; detailKey: "providers.oauthDetail" | "providers.freeDetail" | "providers.apiKeyDetail" | "providers.webAccountDetail" | "providers.otherDetail"; categories: readonly string[] }
const GROUPS: readonly Group[] = [
  { id: "oauth", titleKey: "providers.oauthTitle", detailKey: "providers.oauthDetail", categories: ["oauth"] },
  { id: "free", titleKey: "providers.freeTitle", detailKey: "providers.freeDetail", categories: ["free", "freeTier"] },
  { id: "apikey", titleKey: "providers.apiKeyTitle", detailKey: "providers.apiKeyDetail", categories: ["apikey"] },
  { id: "webCookie", titleKey: "providers.webAccountTitle", detailKey: "providers.webAccountDetail", categories: ["webCookie"] },
];
const OTHER: Group = { id: "other", titleKey: "providers.otherTitle", detailKey: "providers.otherDetail", categories: [] };
const groupOf = (category: string) => GROUPS.find((g) => g.categories.includes(category)) ?? OTHER;

export function LlmProviders() {
  const { t } = useLocale();
  const [filter, setFilter] = useState("");
  const [showAllKeys, setShowAllKeys] = useState(false);
  const catalog = useProviders();
  const connections = useConnections();
  const connected = new Set(connections.data?.map((c) => c.provider));
  const query = filter.trim().toLocaleLowerCase();
  // Media and search services have their own screens; hidden entries are hidden in 9router too.
  const llm = (catalog.data ?? []).filter((p) => p.protocol !== "service" && !p.hidden);
  const matches = llm.filter((p) => p.name.toLocaleLowerCase().includes(query) || p.id.includes(query));
  const connectable = llm.filter((p) => p.connectable).length;
  return <><PageHeading eyebrow={t("providers.catalogEyebrow")} title={t("providers.catalogTitle")} description={t("providers.catalogDescription", { connectable, total: llm.length })} />
    <div className="provider-catalog-toolbar"><input className="input" aria-label={t("providers.search")} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("providers.searchPlaceholder", { count: llm.length })} /><span className="muted mono">{t("providers.builtInCount", { shown: matches.length, total: llm.length })}</span></div>
    {!query && <CustomProviders />}
    {catalog.isPending ? <StateBlock state="loading" />
      : catalog.isError ? <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />
      : <>{[...GROUPS, OTHER].map((group) => {
        const members = matches.filter((p) => groupOf(p.category) === group);
        if (!members.length) return null;
        const visible = group.id === "apikey" && !query && !showAllKeys ? members.slice(0, 20) : members;
        return <section className="catalog-section" key={group.id} aria-labelledby={`${group.id}-heading`}><div className="catalog-section-head"><div><h2 id={`${group.id}-heading`}>{t(group.titleKey)} <span className="muted mono">{members.length}</span></h2><p>{t(group.detailKey)}</p></div></div>
          <div className="catalog-grid">{visible.map((p) => <a className="catalog-card" href={`/providers/detail?provider=${encodeURIComponent(p.id)}`} key={p.id} title={p.reason ?? undefined}><span className="catalog-glyph" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{p.name}</strong><small>{p.modelCount} {t(p.modelCount === 1 ? "providers.modelsOne" : "providers.modelsMany")}</small>{!p.connectable ? <Pill>{t("providers.comingLater")}</Pill> : p.authKinds.includes("none") ? <Pill tone="info">{t("providers.publicAccess")}</Pill> : connected.has(p.id) && <Pill tone="healthy">{t("providers.connected")}</Pill>}</span></a>)}</div>
          {group.id === "apikey" && !query && members.length > 20 && <button className="catalog-more" type="button" onClick={() => setShowAllKeys(!showAllKeys)}>{showAllKeys ? t("providers.showFewer") : t("providers.showAll", { count: members.length })}</button>}
        </section>;
      })}
      {query && !matches.length && <div className="catalog-empty">{t("providers.noProviderMatch", { query: filter })}</div>}</>}
  </>;
}

// The provider detail panel: connected, not connected, or the catalog's reason it cannot be connected yet.
function ProviderConnection({ provider }: { provider: ProviderDetailView }) {
  const { t } = useLocale();
  const connections = useConnections();
  if (!provider.connectable) return <div className="state-block"><strong>{t("providers.comingLater")}</strong><p>{provider.reason}.</p></div>;
  if (connections.isPending) return <StateBlock state="loading" />;
  if (connections.isError) return <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />;
  const connection = connections.data.find((c) => c.provider === provider.id);
  if (provider.authKinds.includes("none")) return <div className="state-block"><strong>{t("providers.publicAccess")}</strong><p>{t("providers.publicHint")}</p><Link className="button button-secondary" to="/network/proxy-pools">{t("providers.configureProxy")}</Link></div>;
  if (!connection) {
    const how = provider.signInOnly ? t("providers.signIn") : provider.signIn ? t("providers.signInOrKey") : t("providers.addApiKey");
    return <div className="state-block"><strong>{t("providers.notConnected")}</strong><p>{t("providers.routeHint", { action: how })}</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>{t("providers.addConnection")}</a></div>;
  }
  const pill = statusPill(connection);
  return <div className="list-row"><div><strong>{connection.name}</strong><small>{connection.authType === "oauth" ? <>{t("providers.signedIn")}{connection.email && <>{t("providers.signedInAs", { email: connection.email })}</>}</> : <>{t("providers.key")} <code>{connection.keyHint}</code></>} · {connection.lastTestedAt ? t("providers.tested", { time: new Date(connection.lastTestedAt).toLocaleString() }) : t("providers.notTestedYet")}</small></div><Pill tone={pill.tone}>{connection.isActive ? t(STATUS_KEYS[connection.testStatus]) : t("providers.statusDisabled")}</Pill><a className="button" href="/providers/connections">{t("providers.manage")}</a></div>;
}

// docs/contracts/provider-thinking.md (routing.provider-thinking-default, kept from 9router): the level a request gets when
// it asks for no thinking itself; only for a model that reasons, and never over the client's own effort or budget.
const levelLabel = (level: string, t: ReturnType<typeof useLocale>["t"]) => (level === "xhigh" ? t("providers.extraHigh") : level.charAt(0).toUpperCase() + level.slice(1));

function ProviderThinking({ provider }: { provider: ProviderDetailView }) {
  const { t } = useLocale();
  const save = useSetThinking(provider.id);
  const showToast = useToast();
  const { level, levels } = provider.thinking;
  if (!levels) return null;
  const change = (next: ThinkingLevel | "auto") => save.mutate(next, {
    onSuccess: () => showToast({ tone: "success", localized: next === "auto" ? { key: "providers.thinkingSavedAuto", params: { provider: provider.name } } : { key: "providers.thinkingSavedLevel", params: { provider: provider.name, level: next } } }),
    onError: (error) => showToast({ tone: "error", error }),
  });
  return <Panel title={t("providers.thinking")} detail={t("providers.thinkingDetail")} className="section-gap">
    <Field label={t("providers.defaultThinking")} hint={t("providers.thinkingHint")}>
      <select className="input" value={level} disabled={save.isPending} onChange={(event) => { const value = event.target.value; const next = value === "auto" ? "auto" : levels.find((item) => item === value); if (next) change(next); }}>
        <option value="auto">{t("providers.auto")}</option>
        {levels.map((item) => <option key={item} value={item}>{levelLabel(item, t)}</option>)}
      </select></Field>
  </Panel>;
}

function CatalogProvider({ providerId }: { providerId: string }) {
  const { t } = useLocale();
  // A custom provider has its own detail page (docs/contracts/custom-models.md); the catalog is asked only otherwise.
  const nodes = useProviderNodes();
  const node = nodes.data?.find((n) => n.id === providerId);
  const detail = useProvider(providerId, !nodes.isPending && !node);
  if (nodes.isPending) return <StateBlock state="loading" />;
  if (node) return <CustomProviderDetail node={node} />;
  if (detail.isPending) return <StateBlock state="loading" />;
  if (detail.isError) {
    const problem = toProblem(detail.error);
    if (problem.code === "NOT_FOUND") return <><PageHeading eyebrow={t("providers.catalogEyebrow")} title={t("providers.providerNotFound")} description={t("providers.providerNotFoundHint", { provider: providerId })} /><Link className="button" to="/providers">{t("providers.backToProviders")}</Link></>;
    return <StateBlock state="error" code={problem.code} action={<Button onClick={() => void detail.refetch()}>Retry</Button>} />;
  }
  const provider = detail.data;
  const group = groupOf(provider.category);
  return <><PageHeading eyebrow={`${t("providers.catalogEyebrow").split(" /")[0]} / ${t(group.titleKey)}`} title={provider.name} description={t("providers.detailDescription")} />
    <div className="grid grid-2"><Panel title={t("providers.providerType")}><Pill tone="info">{t(group.titleKey)}</Pill><p className="muted">{t("providers.builtInEntry")} <code>{provider.id}</code></p>{provider.chatUrl && <p className="muted" style={{ overflowWrap: "anywhere" }}>{t("providers.endpoint")} <code>{provider.chatUrl}</code></p>}</Panel><Panel title={t("providers.connection")}><ProviderConnection provider={provider} /></Panel></div>
    <ProviderThinking provider={provider} />
    <ProviderModels providerId={provider.id} prefix={provider.id} catalog={provider.models} thinking={provider.thinking.level} />
  </>;
}

export function ProviderDetail({ isNew = false, providerId }: { isNew?: boolean; providerId?: string }) {
  const { t } = useLocale();
  if (isNew) return <CustomProviderForm />;
  if (!providerId) return <><PageHeading eyebrow={t("providers.catalogEyebrow")} title={t("providers.providerNotFound")} description={t("providers.noProviderNamed")} /><Link className="button" to="/providers">{t("providers.backToProviders")}</Link></>;
  return <CatalogProvider providerId={providerId} />;
}

// Fields a connection supplies besides its key: connection.ollama-local-host (host, no key needed),
// connection.azure-openai-deployment (9router's form, kept: endpoint, deployment, and organization required),
// connection.cloudflare-account-id. ponytail: fixed here; expose descriptor.connectionFields in GET /api/providers
// when the list grows.
type FieldSpec = { name: ConnectionField; label: string; hint?: string; placeholder?: string; required?: boolean; initial?: string };
const CONNECTION_FIELDS: Readonly<Record<string, readonly FieldSpec[]>> = {
  "ollama-local": [{ name: "baseUrl", label: "Host", hint: "Empty means http://localhost:11434. https, or http to this machine only.", placeholder: "http://localhost:11434" }],
  azure: [
    { name: "baseUrl", label: "Azure endpoint", hint: "https, for example your resource's endpoint.", placeholder: "https://your-resource.openai.azure.com", required: true },
    { name: "deployment", label: "Deployment name", placeholder: "gpt-4", required: true },
    { name: "apiVersion", label: "API version", initial: "2024-10-01-preview" },
    { name: "organization", label: "Organization", hint: "Required for billing.", required: true },
  ],
  "cloudflare-ai": [{ name: "accountId", label: "Account ID", hint: "From the Cloudflare dashboard URL or Workers AI overview.", required: true }],
};
const KEYLESS = new Set(["ollama-local"]);
// provider.vertex-google-auth: the key field also takes a service-account or authorized_user JSON.
const GOOGLE_CLOUD = new Set(["vertex", "vertex-partner"]);
const fieldsOf = (provider: string) => CONNECTION_FIELDS[provider] ?? [];

// Only fields the provider takes: on Add an empty field is left out; on Edit it is sent as "" to clear it.
function fieldValues(form: HTMLFormElement, provider: string, editing: boolean): Partial<Record<ConnectionField, string>> {
  return Object.fromEntries(fieldsOf(provider).map((field) => [field.name, formText(form, field.name)]).filter(([, value]) => editing || value !== ""));
}

function ConnectionFields({ provider, connection, keyLabel }: { provider: string; connection?: Connection; keyLabel?: string }) {
  const { t } = useLocale();
  const fieldLabel = (field: FieldSpec) => provider === "ollama-local" ? t("providers.host") : field.name === "baseUrl" ? t("providers.azureEndpoint") : field.name === "deployment" ? t("providers.deploymentName") : field.name === "apiVersion" ? t("providers.apiVersion") : field.name === "organization" ? t("providers.organization") : t("providers.accountId");
  const fieldHint = (field: FieldSpec) => provider === "ollama-local" ? t("providers.localHostHint") : field.name === "baseUrl" ? t("providers.azureEndpointHint") : field.name === "organization" ? t("providers.organizationHint") : field.name === "accountId" ? t("providers.accountIdHint") : field.hint;
  const fields = fieldsOf(provider).map((field) => <Field key={field.name} label={fieldLabel(field)} hint={fieldHint(field)}>
    <Input name={field.name} required={field.required} maxLength={field.name === "baseUrl" ? 2048 : 128} defaultValue={connection?.[field.name] ?? field.initial ?? ""} placeholder={field.placeholder} />
  </Field>);
  // Editing a connection with fields keeps its key unless a new one is typed.
  const keyOptional = KEYLESS.has(provider) || (connection !== undefined && fields.length > 0);
  const key = GOOGLE_CLOUD.has(provider)
    ? <Field label={keyLabel ?? t("providers.apiKey")} hint={t("providers.googleKeyHint")}>
      <Input name="apiKey" type="password" required minLength={8} maxLength={16384} autoComplete="off" placeholder='{"type": "service_account", …} or an API key' />
    </Field>
    : <Field label={keyLabel ?? t("providers.apiKey")} hint={KEYLESS.has(provider) ? t("providers.optionalLocalKey") : keyOptional ? t("providers.optionalKeepKey") : undefined}>
      <Input name="apiKey" type="password" required={!keyOptional} minLength={8} maxLength={4096} autoComplete="off" placeholder={keyOptional ? undefined : "sk-…"} />
    </Field>;
  return <>{fields}{key}</>;
}

function AddConnection({ requested, onClose, onCreated, onSignedIn }: {
  requested: string | null; onClose: () => void; onCreated: (connection: Connection) => void; onSignedIn: () => void;
}) {
  const { t } = useLocale();
  const catalog = useProviders();
  const nodes = useProviderNodes();
  const create = useCreateConnection();
  const pools = useProxyPools();
  const [chosen, setChosen] = useState("");
  const showToast = useToast();
  if (catalog.isPending || nodes.isPending) return <Modal title={t("providers.addConnection")} onClose={onClose}><StateBlock state="loading" /></Modal>;
  if (catalog.isError || nodes.isError) {
    return <Modal title={t("providers.addConnection")} onClose={onClose}><StateBlock state="error" code={toProblem(catalog.error ?? nodes.error).code} action={<Button onClick={() => { void catalog.refetch(); void nodes.refetch(); }}>{t("common.retry")}</Button>} /></Modal>;
  }
  // Built-in providers that can be connected, then custom providers (docs/contracts/custom-providers.md).
  const builtins = catalog.data.filter((p) => p.connectable && !p.authKinds.includes("none")).sort((a, b) => a.name.localeCompare(b.name));
  const available = [...builtins, ...nodes.data.map((n) => ({ id: n.id, name: `${n.name} (custom)` }))];
  const asked = requested ? catalog.data.find((p) => p.id === requested) : undefined;
  const custom = requested ? nodes.data.some((n) => n.id === requested) : false;
  const blocked = !requested || custom ? null : !asked ? t("providers.notInCatalog", { provider: requested }) : asked.connectable ? null : t("providers.cannotConnect", { provider: asked.name, reason: asked.reason ?? "" });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const [name, apiKey, chosenProvider] = [formText(form, "name"), formText(form, "apiKey"), formText(form, "provider")];
    const proxyPoolId = formText(form, "proxyPoolId");
    const body = { provider: chosenProvider, ...(apiKey ? { apiKey } : {}), ...(name ? { name } : {}), ...(proxyPoolId ? { proxyPoolId } : {}), ...fieldValues(form, chosenProvider, false) };
    create.mutate(body, { onSuccess: onCreated, onError: (error) => showToast({ tone: "error", error }) });
  };
  const provider = available.some((p) => p.id === chosen) ? chosen : available.some((p) => p.id === requested) ? requested ?? "" : available[0]?.id ?? "";
  // docs/contracts/oauth.md: a sign-in provider shows its sign-in; one that takes no key shows only that.
  const summary = catalog.data.find((p) => p.id === provider);
  const picker = <Field label={t("providers.providerType")} hint={t("providers.providerCountHint", { count: available.length })}><select className="input" name="provider" value={provider} onChange={(event) => setChosen(event.target.value)}>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>;
  return <Modal title={t("providers.addConnection")} onClose={onClose}>
    {blocked && <Warning>{blocked}</Warning>}
    {available.length === 0 ? <><p>{t("providers.noConnectable")}</p><div className="modal-actions"><Button onClick={onClose}>{t("common.close")}</Button></div></>
      : <>
        {summary?.signIn && <div className="stack">{picker}<p>{t("providers.signInEncrypted", { provider: summary.name })}</p><SignIn key={summary.id} provider={summary} onDone={onSignedIn} /></div>}
        {!summary?.signInOnly && <form onSubmit={submit}>{summary?.signIn ? <p className="section-gap">{t("providers.orApiKey")}</p> : <p>{t("providers.encryptedSaved")}</p>}
        <div className="stack">
          {summary?.signIn ? <input type="hidden" name="provider" value={provider} /> : picker}
          <Field label={t("providers.name")} hint={t("providers.optionalProviderName")}><Input name="name" maxLength={64} placeholder={t("providers.namePlaceholder")} /></Field>
          <Field label={t("providers.proxyPool")} hint={t("providers.proxyPoolHint")}><select className="input" name="proxyPoolId" defaultValue=""><option value="">{t("providers.directProxy")}</option>{(pools.data ?? []).filter((pool) => pool.isActive).map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.type})</option>)}</select></Field>
          <ConnectionFields key={provider} provider={provider} />
        </div>
        <div className="modal-actions"><Button onClick={onClose}>{t("providers.cancel")}</Button><Button type="submit" variant="primary" disabled={create.isPending}>{create.isPending ? t("providers.saving") : t("providers.saveAndTest")}</Button></div></form>}
        {summary?.signInOnly && <div className="modal-actions"><Button onClick={onClose}>{t("providers.cancel")}</Button></div>}
      </>}
  </Modal>;
}

function ReplaceKey({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: (connection: Connection) => void }) {
  const { t } = useLocale();
  const update = useUpdateConnection();
  const showToast = useToast();
  const editable = fieldsOf(connection.provider).length > 0;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = formText(event.currentTarget, "apiKey");
    // A connection with fields sends them (empty clears one) and keeps its key unless a new one is typed.
    const changes = editable ? { ...fieldValues(event.currentTarget, connection.provider, true), ...(apiKey ? { apiKey } : {}) } : { apiKey };
    update.mutate({ id: connection.id, ...changes }, { onSuccess: onSaved, onError: (error) => showToast({ tone: "error", error }) });
  };
  return <Modal title={`${editable ? t("providers.editConnection") : t("providers.replaceKey")} · ${connection.name}`} onClose={onClose}><form onSubmit={submit}>
    <p>{t("providers.currentKey", { key: connection.keyHint })}</p>
    <ConnectionFields provider={connection.provider} connection={connection} keyLabel={t("providers.newApiKey")} />
    <div className="modal-actions"><Button onClick={onClose}>{t("providers.cancel")}</Button><Button type="submit" variant="primary" disabled={update.isPending}>{update.isPending ? t("providers.saving") : t("providers.saveAndTest")}</Button></div>
  </form></Modal>;
}

export function Connections() {
  const { t } = useLocale();
  const requested = new URLSearchParams(window.location.search).get("provider");
  const [tab, setTab] = useState("all");
  const [adding, setAdding] = useState(Boolean(requested));
  const [replacing, setReplacing] = useState<Connection | null>(null);
  const [signingIn, setSigningIn] = useState<Connection | null>(null);
  const catalog = useProviders();
  const [removing, setRemoving] = useState<Connection | null>(null);
  const connections = useConnections();
  const update = useUpdateConnection();
  const remove = useDeleteConnection();
  const testConnection = useTestConnection();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", error });
  const runTest = (id: string) => testConnection.mutate(id, { onSuccess: (view) => showToast(testNotice(view)), onError: fail });
  const testing = (id: string) => testConnection.isPending && testConnection.variables === id;
  const rows = (connections.data ?? []).filter((c) => tab === "all" || needsAttention(c));

  return <><PageHeading eyebrow={`Providers / ${t("providers.connectionsTitle")}`} title={t("providers.connectionsTitle")} description={t("providers.connectionsDescription")} action={<Button variant="primary" onClick={() => setAdding(true)}>+ {t("providers.addConnection")}</Button>} />
    <div className="section-gap"><Tabs items={[t("providers.allConnections"), t("providers.needsAttention")]} active={tab === "all" ? t("providers.allConnections") : t("providers.needsAttention")} onChange={(value) => setTab(value === t("providers.needsAttention") ? "attention" : "all")} /></div>
    <Panel title={tab === "attention" ? t("providers.connectionsAction") : t("providers.connectedAccounts")} detail={t("providers.priorityHint")} className="section-gap panel-flush">
      {connections.isPending ? <StateBlock state="loading" />
        : connections.isError ? <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />
        : <Table empty={tab === "attention" ? t("providers.attentionEmpty") : t("providers.connectionsEmpty")}
          columns={[t("providers.account"), t("providers.key"), t("providers.status"), t("providers.lastTested"), t("providers.actions")]} rows={rows.map((c) => {
            const pill = statusPill(c);
            const sameProvider = (connections.data ?? []).filter((other) => other.provider === c.provider);
            return [
              <div><strong>{c.name}</strong>{c.name !== c.providerName && <small className="muted"> · {c.providerName}</small>}{c.baseUrl && <small className="muted"> · {c.baseUrl}</small>}{c.deployment && <small className="muted"> · {c.deployment}</small>}{c.accountId && <small className="muted"> · account {c.accountId}</small>}</div>,
              c.authType === "oauth"
                ? <div>{t("providers.signedIn")}{c.email && <>{t("providers.signedInAs", { email: c.email })}</>}{c.expiresAt && <small className="muted"> · {t("providers.tokenUntil", { time: new Date(c.expiresAt).toLocaleString() })}</small>}</div>
                : <code>{c.keyHint}</code>,
              <div><Pill tone={pill.tone}>{c.isActive ? t(STATUS_KEYS[c.testStatus]) : t("providers.statusDisabled")}</Pill>{c.isActive && c.testStatus !== "active" && c.lastError && <small className="muted"> {c.lastError}</small>}</div>,
              c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleString() : t("providers.never"),
              <><Button variant="ghost" disabled={testConnection.isPending} onClick={() => runTest(c.id)}>{testing(c.id) ? t("providers.testing") : t("providers.test")}</Button>
                <Button variant="ghost" disabled={update.isPending || c.priority === 1} onClick={() => update.mutate({ id: c.id, priority: c.priority - 1 }, { onError: fail })}>{t("providers.priorityUp")}</Button>
                <Button variant="ghost" disabled={update.isPending || c.priority === sameProvider.length} onClick={() => update.mutate({ id: c.id, priority: c.priority + 1 }, { onError: fail })}>{t("providers.priorityDown")}</Button>
                {c.authType === "oauth"
                  ? <Button variant="ghost" onClick={() => setSigningIn(c)}>{t("providers.signInAgain")}</Button>
                  : <Button variant="ghost" onClick={() => setReplacing(c)}>{fieldsOf(c.provider).length > 0 ? t("providers.edit") : t("providers.replaceKey")}</Button>}
                <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: c.id, isActive: !c.isActive }, { onError: fail })}>{c.isActive ? t("providers.disable") : t("providers.enable")}</Button>
                <Button variant="ghost" onClick={() => setRemoving(c)}>{t("providers.delete")}</Button></>,
            ];
          })} />}
    </Panel>
    {adding && <AddConnection requested={requested} onClose={() => setAdding(false)} onCreated={(view) => { setAdding(false); runTest(view.id); }} onSignedIn={() => setAdding(false)} />}
    {signingIn && <Modal title={`${t("providers.signInAgain")} · ${signingIn.name}`} onClose={() => setSigningIn(null)}>
      {(() => { const summary = catalog.data?.find((p) => p.id === signingIn.provider); return summary?.signIn ? <SignIn provider={summary} onDone={() => setSigningIn(null)} /> : <StateBlock state="loading" />; })()}
       <p className="muted">{t("providers.sameAccountHint")}</p>
    </Modal>}
    {replacing && <ReplaceKey connection={replacing} onClose={() => setReplacing(null)} onSaved={(view) => { setReplacing(null); runTest(view.id); }} />}
    {removing && <ConfirmDialog name={removing.name} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing.id, {
       onSuccess: () => { setRemoving(null); showToast({ tone: "success", localized: { key: "providers.deleted", params: { name: removing.name } } }); },
      onError: (error) => { setRemoving(null); fail(error); },
    })} />}
  </>;
}
