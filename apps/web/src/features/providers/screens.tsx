import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, CopyField, Field, Input, Metric, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { mediaGroups } from "./catalog";
import { CustomProviderDetail, CustomProviderForm, CustomProviders } from "./custom";
import { ProviderModels } from "./models";
import {
  useConnections, useCreateConnection, useDeleteConnection, useProvider, useProviderNodes, useProviders, useSetThinking, useTestConnection, useUpdateConnection, type Connection,
  type ConnectionField, type ProviderDetailView, type ThinkingLevel,
} from "./api";
import { describeTest, needsAttention, statusPill } from "./test-result";
import { SignIn } from "./sign-in";
import { VoiceBrowser } from "./voice-browser";
import { useProxyPools } from "../network/api";

const formText = (form: HTMLFormElement, name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
};

// Catalog categories in 9router's page order; "free" (keyless) and "freeTier" share one section there.
interface Group { id: string; title: string; categories: readonly string[]; detail: string }
const GROUPS: readonly Group[] = [
  { id: "oauth", title: "OAuth providers", categories: ["oauth"], detail: "Account sign-in and token based connections." },
  { id: "free", title: "Free Tier providers", categories: ["free", "freeTier"], detail: "Providers listed under Free Tier in the 9Router reference; access terms vary." },
  { id: "apikey", title: "API Key providers", categories: ["apikey"], detail: "Connect with a provider-issued API key." },
  { id: "webCookie", title: "Web account providers", categories: ["webCookie"], detail: "Subscription account connections." },
];
const OTHER: Group = { id: "other", title: "Other providers", categories: [], detail: "Providers in a category this dashboard does not name yet." };
const groupOf = (category: string) => GROUPS.find((g) => g.categories.includes(category)) ?? OTHER;
const COMING_LATER = "Coming later";

export function LlmProviders() {
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
  return <><PageHeading eyebrow="Providers / Catalog" title="LLM providers" description={`Browse built-in providers by connection method. ${connectable} of ${llm.length} can be connected today, with an API key or by signing in.`} />
    <div className="provider-catalog-toolbar"><input className="input" aria-label="Search providers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${llm.length} providers…`} /><span className="muted mono">{matches.length} / {llm.length} built-in</span></div>
    {!query && <CustomProviders />}
    {catalog.isPending ? <StateBlock state="loading" />
      : catalog.isError ? <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />
      : <>{[...GROUPS, OTHER].map((group) => {
        const members = matches.filter((p) => groupOf(p.category) === group);
        if (!members.length) return null;
        const visible = group.id === "apikey" && !query && !showAllKeys ? members.slice(0, 20) : members;
        return <section className="catalog-section" key={group.id} aria-labelledby={`${group.id}-heading`}><div className="catalog-section-head"><div><h2 id={`${group.id}-heading`}>{group.title} <span className="muted mono">{members.length}</span></h2><p>{group.detail}</p></div></div>
          <div className="catalog-grid">{visible.map((p) => <a className="catalog-card" href={`/providers/detail?provider=${encodeURIComponent(p.id)}`} key={p.id} title={p.reason ?? undefined}><span className="catalog-glyph" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{p.name}</strong><small>{p.modelCount} model{p.modelCount === 1 ? "" : "s"}</small>{!p.connectable ? <Pill>{COMING_LATER}</Pill> : p.authKinds.includes("none") ? <Pill tone="info">Public</Pill> : connected.has(p.id) && <Pill tone="healthy">Connected</Pill>}</span></a>)}</div>
          {group.id === "apikey" && !query && members.length > 20 && <button className="catalog-more" type="button" onClick={() => setShowAllKeys(!showAllKeys)}>{showAllKeys ? "Show fewer" : `Show all ${members.length} providers`}</button>}
        </section>;
      })}
      {query && !matches.length && <div className="catalog-empty">No providers match “{filter}”.</div>}</>}
  </>;
}

// The provider detail panel: connected, not connected, or the catalog's reason it cannot be connected yet.
function ProviderConnection({ provider }: { provider: ProviderDetailView }) {
  const connections = useConnections();
  if (!provider.connectable) return <div className="state-block"><strong>{COMING_LATER}</strong><p>{provider.reason}.</p></div>;
  if (connections.isPending) return <StateBlock state="loading" />;
  if (connections.isError) return <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />;
  const connection = connections.data.find((c) => c.provider === provider.id);
  if (provider.authKinds.includes("none")) return <div className="state-block"><strong>Public access</strong><p>No provider account or API key is stored. Requests use the configured keyless-provider proxy strategy.</p><Link className="button button-secondary" to="/network/proxy-pools">Configure proxy pools</Link></div>;
  if (!connection) {
    const how = provider.signInOnly ? "Sign in" : provider.signIn ? "Sign in or add an API key" : "Add an API key";
    return <div className="state-block"><strong>Not connected</strong><p>{how} to route requests to this provider.</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>Add connection</a></div>;
  }
  const pill = statusPill(connection);
  return <div className="list-row"><div><strong>{connection.name}</strong><small>{connection.authType === "oauth" ? <>Signed in{connection.email && <> as <code>{connection.email}</code></>}</> : <>Key <code>{connection.keyHint}</code></>} · {connection.lastTestedAt ? `tested ${new Date(connection.lastTestedAt).toLocaleString()}` : "not tested yet"}</small></div><Pill tone={pill.tone}>{pill.label}</Pill><a className="button" href="/providers/connections">Manage</a></div>;
}

// docs/contracts/provider-thinking.md (routing.provider-thinking-default, kept from 9router): the level a request gets when
// it asks for no thinking itself; only for a model that reasons, and never over the client's own effort or budget.
const levelLabel = (level: string) => (level === "xhigh" ? "Extra high" : level.charAt(0).toUpperCase() + level.slice(1));

function ProviderThinking({ provider }: { provider: ProviderDetailView }) {
  const save = useSetThinking(provider.id);
  const showToast = useToast();
  const { level, levels } = provider.thinking;
  if (!levels) return null;
  const change = (next: ThinkingLevel | "auto") => save.mutate(next, {
    onSuccess: () => showToast({ tone: "success", message: next === "auto" ? `${provider.name} leaves thinking to each request.` : `${provider.name} thinks at ${levelLabel(next)} unless a request asks otherwise.` }),
    onError: (error) => showToast({ tone: "error", ...toProblem(error) }),
  });
  return <Panel title="Thinking" detail="The reasoning level sent to this provider when a request asks for none. A request that sets its own effort or budget keeps it; models that do not reason are left alone." className="section-gap">
    <Field label="Default thinking level" hint="Auto sends nothing, so the model uses its own default. The levels are those this provider's API family takes.">
      <select className="input" value={level} disabled={save.isPending} onChange={(event) => { const value = event.target.value; const next = value === "auto" ? "auto" : levels.find((item) => item === value); if (next) change(next); }}>
        <option value="auto">Auto</option>
        {levels.map((item) => <option key={item} value={item}>{levelLabel(item)}</option>)}
      </select></Field>
  </Panel>;
}

function CatalogProvider({ providerId }: { providerId: string }) {
  // A custom provider has its own detail page (docs/contracts/custom-models.md); the catalog is asked only otherwise.
  const nodes = useProviderNodes();
  const node = nodes.data?.find((n) => n.id === providerId);
  const detail = useProvider(providerId, !nodes.isPending && !node);
  if (nodes.isPending) return <StateBlock state="loading" />;
  if (node) return <CustomProviderDetail node={node} />;
  if (detail.isPending) return <StateBlock state="loading" />;
  if (detail.isError) {
    const problem = toProblem(detail.error);
    if (problem.code === "NOT_FOUND") return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description={`"${providerId}" is not in the provider catalog or a custom provider.`} /><Link className="button" to="/providers">Back to providers</Link></>;
    return <StateBlock state="error" code={problem.code} action={<Button onClick={() => void detail.refetch()}>Retry</Button>} />;
  }
  const provider = detail.data;
  const group = groupOf(provider.category);
  return <><PageHeading eyebrow={`Providers / ${group.title}`} title={provider.name} description="Connection status, credentials, and the models this provider offers." />
    <div className="grid grid-2"><Panel title="Provider type"><Pill tone="info">{group.title}</Pill><p className="muted">Built-in catalog entry · ID <code>{provider.id}</code></p>{provider.chatUrl && <p className="muted" style={{ overflowWrap: "anywhere" }}>Endpoint <code>{provider.chatUrl}</code></p>}</Panel><Panel title="Connection"><ProviderConnection provider={provider} /></Panel></div>
    <ProviderThinking provider={provider} />
    <ProviderModels providerId={provider.id} prefix={provider.id} catalog={provider.models} thinking={provider.thinking.level} />
  </>;
}

export function ProviderDetail({ isNew = false, providerId }: { isNew?: boolean; providerId?: string }) {
  if (isNew) return <CustomProviderForm />;
  if (!providerId) return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description="No provider was named in the link." /><Link className="button" to="/providers">Back to providers</Link></>;
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

function ConnectionFields({ provider, connection, keyLabel = "API key" }: { provider: string; connection?: Connection; keyLabel?: string }) {
  const fields = fieldsOf(provider).map((field) => <Field key={field.name} label={field.label} hint={field.hint}>
    <Input name={field.name} required={field.required} maxLength={field.name === "baseUrl" ? 2048 : 128} defaultValue={connection?.[field.name] ?? field.initial ?? ""} placeholder={field.placeholder} />
  </Field>);
  // Editing a connection with fields keeps its key unless a new one is typed.
  const keyOptional = KEYLESS.has(provider) || (connection !== undefined && fields.length > 0);
  const key = GOOGLE_CLOUD.has(provider)
    ? <Field label={keyLabel} hint="Paste the service-account JSON key file from Google Cloud IAM, or a Vertex AI API key.">
      <Input name="apiKey" type="password" required minLength={8} maxLength={16384} autoComplete="off" placeholder='{"type": "service_account", …} or an API key' />
    </Field>
    : <Field label={keyLabel} hint={KEYLESS.has(provider) ? "Optional: a local Ollama needs no key." : keyOptional ? "Optional: leave empty to keep the current key." : undefined}>
      <Input name="apiKey" type="password" required={!keyOptional} minLength={8} maxLength={4096} autoComplete="off" placeholder={keyOptional ? undefined : "sk-…"} />
    </Field>;
  return <>{fields}{key}</>;
}

function AddConnection({ requested, onClose, onCreated, onSignedIn }: {
  requested: string | null; onClose: () => void; onCreated: (connection: Connection) => void; onSignedIn: () => void;
}) {
  const catalog = useProviders();
  const nodes = useProviderNodes();
  const create = useCreateConnection();
  const pools = useProxyPools();
  const [chosen, setChosen] = useState("");
  const showToast = useToast();
  if (catalog.isPending || nodes.isPending) return <Modal title="Add connection" onClose={onClose}><StateBlock state="loading" /></Modal>;
  if (catalog.isError || nodes.isError) {
    return <Modal title="Add connection" onClose={onClose}><StateBlock state="error" code={toProblem(catalog.error ?? nodes.error).code} action={<Button onClick={() => { void catalog.refetch(); void nodes.refetch(); }}>Retry</Button>} /></Modal>;
  }
  // Built-in providers that can be connected, then custom providers (docs/contracts/custom-providers.md).
  const builtins = catalog.data.filter((p) => p.connectable && !p.authKinds.includes("none")).sort((a, b) => a.name.localeCompare(b.name));
  const available = [...builtins, ...nodes.data.map((n) => ({ id: n.id, name: `${n.name} (custom)` }))];
  const asked = requested ? catalog.data.find((p) => p.id === requested) : undefined;
  const custom = requested ? nodes.data.some((n) => n.id === requested) : false;
  const blocked = !requested || custom ? null : !asked ? `${requested} is not in the provider catalog or a custom provider.` : asked.connectable ? null : `${asked.name} cannot be connected yet: ${asked.reason}.`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const [name, apiKey, chosenProvider] = [formText(form, "name"), formText(form, "apiKey"), formText(form, "provider")];
    const proxyPoolId = formText(form, "proxyPoolId");
    const body = { provider: chosenProvider, ...(apiKey ? { apiKey } : {}), ...(name ? { name } : {}), ...(proxyPoolId ? { proxyPoolId } : {}), ...fieldValues(form, chosenProvider, false) };
    create.mutate(body, { onSuccess: onCreated, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  const provider = available.some((p) => p.id === chosen) ? chosen : available.some((p) => p.id === requested) ? requested ?? "" : available[0]?.id ?? "";
  // docs/contracts/oauth.md: a sign-in provider shows its sign-in; one that takes no key shows only that.
  const summary = catalog.data.find((p) => p.id === provider);
  const picker = <Field label="Provider" hint={`${available.length} providers can be connected.`}><select className="input" name="provider" value={provider} onChange={(event) => setChosen(event.target.value)}>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>;
  return <Modal title="Add connection" onClose={onClose}>
    {blocked && <Warning>{blocked}</Warning>}
    {available.length === 0 ? <><p>No provider can be connected yet.</p><div className="modal-actions"><Button onClick={onClose}>Close</Button></div></>
      : <>
        {summary?.signIn && <div className="stack">{picker}<p>Sign in with your {summary.name} account. The tokens are encrypted before they are saved.</p><SignIn key={summary.id} provider={summary} onDone={onSignedIn} /></div>}
        {!summary?.signInOnly && <form onSubmit={submit}>{summary?.signIn ? <p className="section-gap">Or connect with an API key instead.</p> : <p>The key is encrypted before it is saved and is never shown again. AIGate tests it right after saving.</p>}
        <div className="stack">
          {summary?.signIn ? <input type="hidden" name="provider" value={provider} /> : picker}
          <Field label="Name" hint="Optional. Defaults to the provider name."><Input name="name" maxLength={64} placeholder="e.g. Work account" /></Field>
          <Field label="Proxy pool" hint="Optional. Use the Network page to add or test pools."><select className="input" name="proxyPoolId" defaultValue=""><option value="">Direct / environment proxy</option>{(pools.data ?? []).filter((pool) => pool.isActive).map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.type})</option>)}</select></Field>
          <ConnectionFields key={provider} provider={provider} />
        </div>
        <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save and test"}</Button></div></form>}
        {summary?.signInOnly && <div className="modal-actions"><Button onClick={onClose}>Cancel</Button></div>}
      </>}
  </Modal>;
}

function ReplaceKey({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: (connection: Connection) => void }) {
  const update = useUpdateConnection();
  const showToast = useToast();
  const editable = fieldsOf(connection.provider).length > 0;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = formText(event.currentTarget, "apiKey");
    // A connection with fields sends them (empty clears one) and keeps its key unless a new one is typed.
    const changes = editable ? { ...fieldValues(event.currentTarget, connection.provider, true), ...(apiKey ? { apiKey } : {}) } : { apiKey };
    update.mutate({ id: connection.id, ...changes }, { onSuccess: onSaved, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  return <Modal title={`${editable ? "Edit connection" : "Replace key"} · ${connection.name}`} onClose={onClose}><form onSubmit={submit}>
    <p>The current key is <code>{connection.keyHint}</code>. The change is saved and tested right away.</p>
    <ConnectionFields provider={connection.provider} connection={connection} keyLabel="New API key" />
    <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save and test"}</Button></div>
  </form></Modal>;
}

export function Connections() {
  const requested = new URLSearchParams(window.location.search).get("provider");
  const [tab, setTab] = useState("All connections");
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
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const runTest = (id: string) => testConnection.mutate(id, { onSuccess: (view) => showToast(describeTest(view)), onError: fail });
  const testing = (id: string) => testConnection.isPending && testConnection.variables === id;
  const rows = (connections.data ?? []).filter((c) => tab === "All connections" || needsAttention(c));

  return <><PageHeading eyebrow="Providers / Connections" title="Connections" description="Provider accounts, their keys, and whether the last test passed." action={<Button variant="primary" onClick={() => setAdding(true)}>+ Add connection</Button>} />
    <div className="section-gap"><Tabs items={["All connections", "Needs attention"]} active={tab} onChange={setTab} /></div>
    <Panel title={tab === "Needs attention" ? "Connections requiring action" : "Connected accounts"} detail="Accounts are tried by priority; add another account for fallback." className="section-gap panel-flush">
      {connections.isPending ? <StateBlock state="loading" />
        : connections.isError ? <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />
        : <Table empty={tab === "Needs attention" ? "Every connection is enabled and its last test passed." : "No connections yet. Add one to route requests to a provider."}
          columns={["Account", "Key", "Status", "Last tested", "Actions"]} rows={rows.map((c) => {
            const pill = statusPill(c);
            const sameProvider = (connections.data ?? []).filter((other) => other.provider === c.provider);
            return [
              <div><strong>{c.name}</strong>{c.name !== c.providerName && <small className="muted"> · {c.providerName}</small>}{c.baseUrl && <small className="muted"> · {c.baseUrl}</small>}{c.deployment && <small className="muted"> · {c.deployment}</small>}{c.accountId && <small className="muted"> · account {c.accountId}</small>}</div>,
              c.authType === "oauth"
                ? <div>Signed in{c.email && <> as <code>{c.email}</code></>}{c.expiresAt && <small className="muted"> · token until {new Date(c.expiresAt).toLocaleString()}</small>}</div>
                : <code>{c.keyHint}</code>,
              <div><Pill tone={pill.tone}>{pill.label}</Pill>{c.isActive && c.testStatus !== "active" && c.lastError && <small className="muted"> {c.lastError}</small>}</div>,
              c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleString() : "Never",
              <><Button variant="ghost" disabled={testConnection.isPending} onClick={() => runTest(c.id)}>{testing(c.id) ? "Testing…" : "Test"}</Button>
                <Button variant="ghost" disabled={update.isPending || c.priority === 1} onClick={() => update.mutate({ id: c.id, priority: c.priority - 1 }, { onError: fail })}>Priority ↑</Button>
                <Button variant="ghost" disabled={update.isPending || c.priority === sameProvider.length} onClick={() => update.mutate({ id: c.id, priority: c.priority + 1 }, { onError: fail })}>Priority ↓</Button>
                {c.authType === "oauth"
                  ? <Button variant="ghost" onClick={() => setSigningIn(c)}>Sign in again</Button>
                  : <Button variant="ghost" onClick={() => setReplacing(c)}>{fieldsOf(c.provider).length > 0 ? "Edit" : "Replace key"}</Button>}
                <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: c.id, isActive: !c.isActive }, { onError: fail })}>{c.isActive ? "Disable" : "Enable"}</Button>
                <Button variant="ghost" onClick={() => setRemoving(c)}>Delete</Button></>,
            ];
          })} />}
    </Panel>
    {adding && <AddConnection requested={requested} onClose={() => setAdding(false)} onCreated={(view) => { setAdding(false); runTest(view.id); }} onSignedIn={() => setAdding(false)} />}
    {signingIn && <Modal title={`Sign in again · ${signingIn.name}`} onClose={() => setSigningIn(null)}>
      {(() => { const summary = catalog.data?.find((p) => p.id === signingIn.provider); return summary?.signIn ? <SignIn provider={summary} onDone={() => setSigningIn(null)} /> : <StateBlock state="loading" />; })()}
      <p className="muted">Signing in with the same account replaces its tokens. A different account is added separately from Add connection.</p>
    </Modal>}
    {replacing && <ReplaceKey connection={replacing} onClose={() => setReplacing(null)} onSaved={(view) => { setReplacing(null); runTest(view.id); }} />}
    {removing && <ConfirmDialog name={removing.name} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing.id, {
      onSuccess: () => { setRemoving(null); showToast({ tone: "success", message: `Deleted ${removing.name}. Its key was removed.` }); },
      onError: (error) => { setRemoving(null); fail(error); },
    })} />}
  </>;
}

export function Quota() {
  const rows = [["Anthropic primary", "Claude Sonnet", 83, "3h 24m"], ["OpenAI primary", "GPT-4o", 54, "1h 18m"], ["Google Vertex", "Gemini Pro", 31, "Tomorrow"], ["DeepSeek primary", "DeepSeek R1", 92, "43m"]] as const;
  return <><PageHeading eyebrow="Providers / Quota" title="Quota tracker" description="Usage limits and reset windows for connected accounts." action={<Button>Refresh quotas</Button>} />
    <div className="grid grid-3"><Metric label="Healthy quotas" value="38" delta="Across 41 accounts" /><Metric label="Near limit" value="2" delta="Action recommended" tone="warning" /><Metric label="Exhausted" value="1" delta="Resets in 43 min" tone="danger" /></div>
    <Panel title="Account limits" detail="Live and cached provider quota signals" className="section-gap"><div className="stack">{rows.map(([name, model, used, reset]) => <div className="quota-row" key={name}><div className="row between"><strong>{name}</strong><span className="muted mono">{used}% used</span></div><small>{model} · resets {reset}</small><div className={`progress ${used > 85 ? "danger" : used > 75 ? "warning" : ""}`}><span style={{ width: `${used}%` }} /></div></div>)}</div></Panel>
  </>;
}

export function MediaProviders({ kind, providerId }: { kind?: string; providerId?: string }) {
  const catalog = useProviders();
  const connections = useConnections();
  const group = mediaGroups.find((item) => item.id === kind);
  const providers = (catalog.data ?? []).filter((item) => !item.hidden && item.serviceKinds.includes(kind ?? ""));
  const provider = providers.find((item) => item.id === providerId);
  if (providerId && catalog.isPending) return <StateBlock state="loading" />;
  if (providerId && catalog.isError) return <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />;
  if (provider) {
    const connection = connections.data?.find((item) => item.provider === provider.id && item.isActive);
    const routable = provider.routeKinds.includes(group!.id);
    return <><PageHeading eyebrow={`Providers / Media / ${group!.title}`} title={provider.name} description={`Built-in ${group!.title.toLowerCase()} provider · ID ${provider.id}.`} action={provider.connectable && routable ? <a className="button button-primary" href={`/providers/connections?provider=${provider.id}`}>+ Add connection</a> : undefined} />
      <div className="split"><Panel title="Connection setup">{catalog.isPending || connections.isPending ? <StateBlock state="loading" />
        : catalog.isError || connections.isError ? <StateBlock state="error" code={toProblem(catalog.error ?? connections.error).code} action={<Button onClick={() => { void catalog.refetch(); void connections.refetch(); }}>Retry</Button>} />
          : !routable ? <div className="state-block"><strong>Route not available</strong><p>AIGate lists this provider's capability but does not have a working route for it yet.</p></div>
          : connection ? <div className="state-block"><strong>Connected · {connection.name}</strong><p>{connection.testStatus === "active" ? "The connection is enabled and its latest test passed." : connection.lastError ?? "Enabled; connection health has not been confirmed."}</p><a className="button" href="/providers/connections">Manage connection</a></div>
            : provider.connectable ? <div className="state-block"><strong>No active connection</strong><p>Add a provider account to route requests through this media lane.</p></div>
              : <div className="state-block"><strong>Not connectable yet</strong><p>{provider.reason ?? "This provider has no active adapter."}</p></div>}</Panel>
        <Panel title="Endpoint">{group!.endpoint ? <CopyField label={`POST ${group!.endpoint}`} value={`${window.location.origin}${group!.endpoint}`} /> : <p>This kind has no AIGate endpoint yet.</p>}</Panel></div>
      {kind === "tts" && <VoiceBrowser providers={providers} connections={connections.data ?? []} initialProvider={provider.id} />}
    </>;
  }
  if (kind && !group) return <><PageHeading eyebrow="Providers / Media" title="Media kind not found" description="This capability is not in the current catalog." /><Link to="/providers/media" className="button">Back to media providers</Link></>;
  if (group) return <><PageHeading eyebrow="Providers / Media" title={`${group.title} providers`} description={`${providers.filter((item) => item.routeKinds.includes(group.id)).length} of ${providers.length} catalog providers have an AIGate route for this kind.`} />
    <nav className="tabs media-tabs" aria-label="Media kinds">{mediaGroups.map((item) => <a key={item.id} className={item.id === group.id ? "active" : ""} aria-current={item.id === group.id ? "page" : undefined} href={`/providers/media/catalog?kind=${item.id}`}>{item.title}</a>)}</nav>
    <div className="section-gap">{group.endpoint ? <CopyField label="POST endpoint" value={`${window.location.origin}${group.endpoint}`} /> : <p className="muted">AIGate does not have an endpoint for this kind yet.</p>}</div>
    {catalog.isPending ? <StateBlock state="loading" /> : catalog.isError ? <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />
      : providers.length ? <div className="catalog-grid section-gap">{providers.map((item) => {
        const connection = connections.data?.find((c) => c.provider === item.id && c.isActive);
        return <a className="catalog-card" href={`/providers/media/provider?kind=${group.id}&provider=${item.id}`} key={item.id}><span className="catalog-glyph" aria-hidden="true">{item.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{item.name}</strong><small>{!item.routeKinds.includes(group.id) ? "Route not available" : connections.isPending ? "Loading connection…" : connection ? `Connected · ${connection.name}` : item.connectable ? "Ready to connect" : item.reason ?? "Not connectable yet"}</small></span></a>;
      })}</div> : <div className="state-block"><strong>No providers listed</strong><p>No provider in the current catalog advertises this capability yet.</p><a className="button" href="/providers/connections">Manage connections</a></div>}
    {kind === "tts" && !catalog.isPending && !catalog.isError && <VoiceBrowser providers={providers} connections={connections.data ?? []} />}</>;
  return <><PageHeading eyebrow="Providers / Media" title="Media providers" description="Browse the providers available for each media capability." />
    {catalog.isPending ? <StateBlock state="loading" /> : catalog.isError ? <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />
      : <div className="grid grid-3">{mediaGroups.map((item) => {
        const matches = catalog.data.filter((p) => !p.hidden && p.serviceKinds.includes(item.id));
        const count = matches.filter((p) => p.routeKinds.includes(item.id)).length;
        return <a href={`/providers/media/catalog?kind=${item.id}`} className="media-card" key={item.id}><div className="row between"><span className="media-icon">{item.title.slice(0, 1)}</span><Pill tone={count ? "info" : undefined}>{count ? `${count} routable` : "Unconfigured"}</Pill></div><strong>{item.title}</strong><small>{matches.length ? `${matches.length} catalog providers · browse →` : "No provider advertises this capability yet."}</small></a>;
      })}</div>}
  </>;
}
