import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, Metric, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { mediaGroups } from "./catalog";
import { CustomProviderForm, CustomProviders } from "./custom";
import {
  useConnections, useCreateConnection, useDeleteConnection, useProvider, useProviderNodes, useProviders, useTestConnection, useUpdateConnection, type Connection,
  type ProviderDetailView,
} from "./api";
import { describeTest, needsAttention, statusPill } from "./test-result";

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
  return <><PageHeading eyebrow="Providers / Catalog" title="LLM providers" description={`Browse built-in providers by connection method. ${connectable} of ${llm.length} can be connected with an API key today.`} />
    <div className="provider-catalog-toolbar"><input className="input" aria-label="Search providers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${llm.length} providers…`} /><span className="muted mono">{matches.length} / {llm.length} built-in</span></div>
    {!query && <CustomProviders />}
    {catalog.isPending ? <StateBlock state="loading" />
      : catalog.isError ? <StateBlock state="error" code={toProblem(catalog.error).code} action={<Button onClick={() => void catalog.refetch()}>Retry</Button>} />
      : <>{[...GROUPS, OTHER].map((group) => {
        const members = matches.filter((p) => groupOf(p.category) === group);
        if (!members.length) return null;
        const visible = group.id === "apikey" && !query && !showAllKeys ? members.slice(0, 20) : members;
        return <section className="catalog-section" key={group.id} aria-labelledby={`${group.id}-heading`}><div className="catalog-section-head"><div><h2 id={`${group.id}-heading`}>{group.title} <span className="muted mono">{members.length}</span></h2><p>{group.detail}</p></div></div>
          <div className="catalog-grid">{visible.map((p) => <a className="catalog-card" href={`/providers/detail?provider=${encodeURIComponent(p.id)}`} key={p.id} title={p.reason ?? undefined}><span className="catalog-glyph" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{p.name}</strong><small>{p.modelCount} model{p.modelCount === 1 ? "" : "s"}</small>{connected.has(p.id) ? <Pill tone="healthy">Connected</Pill> : !p.connectable && <Pill>{COMING_LATER}</Pill>}</span></a>)}</div>
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
  if (!connection) {
    return <div className="state-block"><strong>Not connected</strong><p>Add an API key to route requests to this provider.</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(provider.id)}`}>Add connection</a></div>;
  }
  const pill = statusPill(connection);
  return <div className="list-row"><div><strong>{connection.name}</strong><small>Key <code>{connection.keyHint}</code> · {connection.lastTestedAt ? `tested ${new Date(connection.lastTestedAt).toLocaleString()}` : "not tested yet"}</small></div><Pill tone={pill.tone}>{pill.label}</Pill><a className="button" href="/providers/connections">Manage</a></div>;
}

const limit = (value: number | null) => (value === null ? <span className="muted">not declared</span> : value.toLocaleString());
const capabilityList = (capabilities: Record<string, boolean>) => Object.keys(capabilities).filter((name) => capabilities[name]).join(", ") || "—";

function CatalogProvider({ providerId }: { providerId: string }) {
  const detail = useProvider(providerId);
  if (detail.isPending) return <StateBlock state="loading" />;
  if (detail.isError) {
    const problem = toProblem(detail.error);
    if (problem.code === "NOT_FOUND") return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description={`"${providerId}" is not in the provider catalog.`} /><Link className="button" to="/providers">Back to providers</Link></>;
    return <StateBlock state="error" code={problem.code} action={<Button onClick={() => void detail.refetch()}>Retry</Button>} />;
  }
  const provider = detail.data;
  const group = groupOf(provider.category);
  return <><PageHeading eyebrow={`Providers / ${group.title}`} title={provider.name} description="Connection status, credentials, and the models this provider offers." />
    <div className="grid grid-2"><Panel title="Provider type"><Pill tone="info">{group.title}</Pill><p className="muted">Built-in catalog entry · ID <code>{provider.id}</code></p>{provider.chatUrl && <p className="muted" style={{ overflowWrap: "anywhere" }}>Endpoint <code>{provider.chatUrl}</code></p>}</Panel><Panel title="Connection"><ProviderConnection provider={provider} /></Panel></div>
    <Panel title="Models" detail={`${provider.models.length} in the catalog. A provider may serve more; "<provider>/<model>" reaches any of them.`} className="section-gap panel-flush">
      <Table empty="The catalog lists no models for this provider." columns={["Model", "Kind", "Context window", "Max output", "Capabilities"]}
        rows={provider.models.map((m) => [<div><strong>{m.name}</strong>{m.name !== m.id && <small className="muted"> <code>{m.id}</code></small>}</div>, m.kind, limit(m.contextWindow), limit(m.maxOutputTokens), capabilityList(m.capabilities)])} />
    </Panel>
  </>;
}

export function ProviderDetail({ isNew = false, providerId }: { isNew?: boolean; providerId?: string }) {
  if (isNew) return <CustomProviderForm />;
  if (!providerId) return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description="No provider was named in the link." /><Link className="button" to="/providers">Back to providers</Link></>;
  return <CatalogProvider providerId={providerId} />;
}

// connection.ollama-local-host: providers whose connection takes its own host and may have no key.
// ponytail: one provider today; expose the descriptor flags in GET /api/providers when a second one arrives.
const HOSTED = new Set(["ollama-local"]);

function HostAndKey({ hosted, host, keyLabel = "API key" }: { hosted: boolean; host?: string | null; keyLabel?: string }) {
  if (!hosted) return <Field label={keyLabel}><Input name="apiKey" type="password" required minLength={8} maxLength={4096} autoComplete="off" placeholder="sk-…" /></Field>;
  return <>
    <Field label="Host" hint="Empty means http://localhost:11434. https, or http to this machine only."><Input name="baseUrl" maxLength={2048} defaultValue={host ?? ""} placeholder="http://localhost:11434" /></Field>
    <Field label={keyLabel} hint="Optional: a local Ollama needs no key."><Input name="apiKey" type="password" minLength={8} maxLength={4096} autoComplete="off" /></Field>
  </>;
}

function AddConnection({ requested, connected, onClose, onCreated }: {
  requested: string | null; connected: ReadonlySet<string>; onClose: () => void; onCreated: (connection: Connection) => void;
}) {
  const catalog = useProviders();
  const nodes = useProviderNodes();
  const create = useCreateConnection();
  const [chosen, setChosen] = useState("");
  const showToast = useToast();
  if (catalog.isPending || nodes.isPending) return <Modal title="Add connection" onClose={onClose}><StateBlock state="loading" /></Modal>;
  if (catalog.isError || nodes.isError) {
    return <Modal title="Add connection" onClose={onClose}><StateBlock state="error" code={toProblem(catalog.error ?? nodes.error).code} action={<Button onClick={() => { void catalog.refetch(); void nodes.refetch(); }}>Retry</Button>} /></Modal>;
  }
  // Built-in providers that can be connected, then custom providers (docs/contracts/custom-providers.md).
  const builtins = catalog.data.filter((p) => p.connectable && !connected.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  const available = [...builtins, ...nodes.data.filter((n) => !connected.has(n.id)).map((n) => ({ id: n.id, name: `${n.name} (custom)` }))];
  const asked = requested ? catalog.data.find((p) => p.id === requested) : undefined;
  const custom = requested ? nodes.data.some((n) => n.id === requested) : false;
  const blocked = !requested || custom ? null : !asked ? `${requested} is not in the provider catalog or a custom provider.` : asked.connectable ? null : `${asked.name} cannot be connected yet: ${asked.reason}.`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const [name, apiKey, baseUrl] = [formText(form, "name"), formText(form, "apiKey"), formText(form, "baseUrl")];
    const body = { provider: formText(form, "provider"), ...(apiKey ? { apiKey } : {}), ...(name ? { name } : {}), ...(baseUrl ? { baseUrl } : {}) };
    create.mutate(body, { onSuccess: onCreated, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  const provider = available.some((p) => p.id === chosen) ? chosen : available.some((p) => p.id === requested) ? requested ?? "" : available[0]?.id ?? "";
  return <Modal title="Add connection" onClose={onClose}>
    {blocked && <Warning>{blocked}</Warning>}
    {available.length === 0 ? <><p>Every connectable provider is already connected. Use Replace key on its row to change a key.</p><div className="modal-actions"><Button onClick={onClose}>Close</Button></div></>
      : <form onSubmit={submit}><p>The key is encrypted before it is saved and is never shown again. AIGate tests it right after saving.</p>
        <div className="stack">
          <Field label="Provider" hint={`${available.length} providers can be connected with an API key.`}><select className="input" name="provider" value={provider} onChange={(event) => setChosen(event.target.value)}>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Name" hint="Optional. Defaults to the provider name."><Input name="name" maxLength={64} placeholder="e.g. Work account" /></Field>
          <HostAndKey hosted={HOSTED.has(provider)} />

        </div>
        <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save and test"}</Button></div></form>}
  </Modal>;
}

function ReplaceKey({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: (connection: Connection) => void }) {
  const update = useUpdateConnection();
  const showToast = useToast();
  const hosted = HOSTED.has(connection.provider);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = formText(event.currentTarget, "apiKey");
    // A hosted connection sends its host (empty clears it) and keeps its key unless a new one is typed.
    const changes = hosted ? { baseUrl: formText(event.currentTarget, "baseUrl"), ...(apiKey ? { apiKey } : {}) } : { apiKey };
    update.mutate({ id: connection.id, ...changes }, { onSuccess: onSaved, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  return <Modal title={`${hosted ? "Edit connection" : "Replace key"} · ${connection.name}`} onClose={onClose}><form onSubmit={submit}>
    <p>The current key is <code>{connection.keyHint}</code>. The change is saved and tested right away.</p>
    <HostAndKey hosted={hosted} host={connection.baseUrl} keyLabel="New API key" />
    <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save and test"}</Button></div>
  </form></Modal>;
}

export function Connections() {
  const requested = new URLSearchParams(window.location.search).get("provider");
  const [tab, setTab] = useState("All connections");
  const [adding, setAdding] = useState(Boolean(requested));
  const [replacing, setReplacing] = useState<Connection | null>(null);
  const [removing, setRemoving] = useState<Connection | null>(null);
  const connections = useConnections();
  const update = useUpdateConnection();
  const remove = useDeleteConnection();
  const testConnection = useTestConnection();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const runTest = (id: string) => testConnection.mutate(id, { onSuccess: (view) => showToast(describeTest(view)), onError: fail });
  const testing = (id: string) => testConnection.isPending && testConnection.variables === id;
  const connected = new Set(connections.data?.map((c) => c.provider));
  const rows = (connections.data ?? []).filter((c) => tab === "All connections" || needsAttention(c));

  return <><PageHeading eyebrow="Providers / Connections" title="Connections" description="Provider accounts, their keys, and whether the last test passed." action={<Button variant="primary" onClick={() => setAdding(true)}>+ Add connection</Button>} />
    <div className="section-gap"><Tabs items={["All connections", "Needs attention"]} active={tab} onChange={setTab} /></div>
    <Panel title={tab === "Needs attention" ? "Connections requiring action" : "Connected accounts"} detail="One API-key account per provider in this version." className="section-gap panel-flush">
      {connections.isPending ? <StateBlock state="loading" />
        : connections.isError ? <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />
        : <Table empty={tab === "Needs attention" ? "Every connection is enabled and its last test passed." : "No connections yet. Add one to route requests to a provider."}
          columns={["Account", "Key", "Status", "Last tested", "Actions"]} rows={rows.map((c) => {
            const pill = statusPill(c);
            return [
              <div><strong>{c.name}</strong>{c.name !== c.providerName && <small className="muted"> · {c.providerName}</small>}{c.baseUrl && <small className="muted"> · {c.baseUrl}</small>}</div>,
              <code>{c.keyHint}</code>,
              <div><Pill tone={pill.tone}>{pill.label}</Pill>{c.isActive && c.testStatus !== "active" && c.lastError && <small className="muted"> {c.lastError}</small>}</div>,
              c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleString() : "Never",
              <><Button variant="ghost" disabled={testConnection.isPending} onClick={() => runTest(c.id)}>{testing(c.id) ? "Testing…" : "Test"}</Button>
                <Button variant="ghost" onClick={() => setReplacing(c)}>{HOSTED.has(c.provider) ? "Edit" : "Replace key"}</Button>
                <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: c.id, isActive: !c.isActive }, { onError: fail })}>{c.isActive ? "Disable" : "Enable"}</Button>
                <Button variant="ghost" onClick={() => setRemoving(c)}>Delete</Button></>,
            ];
          })} />}
    </Panel>
    {adding && <AddConnection requested={requested} connected={connected} onClose={() => setAdding(false)} onCreated={(view) => { setAdding(false); runTest(view.id); }} />}
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
  const group = mediaGroups.find((item) => item.id === kind);
  const provider = group?.providers.find(([id]) => id === providerId);
  if (provider) return <><PageHeading eyebrow={`Providers / Media / ${group!.title}`} title={provider[1]} description={`Built-in ${group!.title.toLowerCase()} provider · ID ${provider[0]}.`} action={<a className="button button-primary" href={`/providers/connections?provider=${provider[0]}`}>+ Add connection</a>} /><Panel title="Connection setup"><div className="state-block"><strong>No AIGate connection data yet</strong><p>Provider-specific authentication and model setup will appear after backend integration.</p></div></Panel></>;
  if (kind && !group) return <><PageHeading eyebrow="Providers / Media" title="Media kind not found" description="This capability is not in the current catalog." /><Link to="/providers/media" className="button">Back to media providers</Link></>;
  if (group) return <><PageHeading eyebrow="Providers / Media" title={`${group.title} providers`} description={`${group.providers.length} built-in provider${group.providers.length === 1 ? "" : "s"} in the 9Router reference catalog. Connection data is pending.`} />
    <div className="catalog-grid">{group.providers.map(([id, name]) => <a className="catalog-card" href={`/providers/media/provider?kind=${group.id}&provider=${id}`} key={id}><span className="catalog-glyph" aria-hidden="true">{name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{name}</strong><small>View provider →</small></span></a>)}</div></>;
  return <><PageHeading eyebrow="Providers / Media" title="Media providers" description="Browse the providers available for each media capability." />
    <div className="grid grid-3">{mediaGroups.map((item) => <a href={`/providers/media/catalog?kind=${item.id}`} className="media-card" key={item.id}><div className="row between"><span className="media-icon">{item.title.slice(0, 1)}</span><Pill tone="info">{item.providers.length} providers</Pill></div><strong>{item.title}</strong><small>Browse built-in providers →</small></a>)}{["Image understanding", "Music"].map((title) => <div className="media-card" key={title}><div className="row between"><span className="media-icon">{title.slice(0, 1)}</span><Pill>Pending</Pill></div><strong>{title}</strong><small>No provider list on the 9Router reference page.</small></div>)}</div>
  </>;
}
