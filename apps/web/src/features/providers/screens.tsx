import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, Metric, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { allProviders, mediaGroups, providerGroups, providers } from "./catalog";
import {
  useConnections, useCreateConnection, useDeleteConnection, useSupportedProviders, useTestConnection, useUpdateConnection, type Connection,
} from "./api";
import { describeTest, needsAttention, statusPill } from "./test-result";

const formText = (form: HTMLFormElement, name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
};

export function LlmProviders() {
  const [filter, setFilter] = useState("");
  const [showAllKeys, setShowAllKeys] = useState(false);
  const connections = useConnections();
  const connected = new Set(connections.data?.map((c) => c.provider));
  const query = filter.trim().toLocaleLowerCase();
  return <><PageHeading eyebrow="Providers / Catalog" title="LLM providers" description="Browse built-in providers by connection method. OpenAI can be connected today; the rest arrive with the full catalog (SP13)." />
    <div className="provider-catalog-toolbar"><input className="input" aria-label="Search providers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${providers.length} providers…`} /><span className="muted mono">{providers.filter((p) => p.name.toLocaleLowerCase().includes(query)).length} / {providers.length} built-in</span></div>
    {!query && <section className="catalog-section"><div className="catalog-section-head"><div><h2>Custom providers</h2><p>OpenAI or Anthropic compatible endpoints you define.</p></div><div className="row"><a className="button" href="/providers/new?protocol=anthropic">+ Anthropic compatible</a><a className="button button-primary" href="/providers/new?protocol=openai">+ OpenAI compatible</a></div></div><div className="catalog-empty">Custom providers are not available yet.</div></section>}
    {providerGroups.map((group) => {
      const matches = group.providers.filter(([, name]) => name.toLocaleLowerCase().includes(query));
      if (!matches.length) return null;
      const visible = group.id === "apikey" && !query && !showAllKeys ? matches.slice(0, 20) : matches;
      return <section className="catalog-section" key={group.id} aria-labelledby={`${group.id}-heading`}><div className="catalog-section-head"><div><h2 id={`${group.id}-heading`}>{group.title} <span className="muted mono">{matches.length}</span></h2><p>{group.id === "oauth" ? "Account sign-in and token based connections." : group.id === "free" ? "Providers listed under Free Tier in the 9Router reference; access terms vary." : group.id === "webCookie" ? "Subscription account connections; provider-specific setup is pending." : "Connect with a provider-issued API key."}</p></div></div>
        <div className="catalog-grid">{visible.map(([id, name]) => <a className="catalog-card" href={`/providers/detail?provider=${id}`} key={id}><span className="catalog-glyph" aria-hidden="true">{name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{name}</strong><small>View provider →</small></span>{connected.has(id) && <Pill tone="healthy">Connected</Pill>}</a>)}</div>
        {group.id === "apikey" && !query && <button className="catalog-more" type="button" onClick={() => setShowAllKeys(!showAllKeys)}>{showAllKeys ? "Show fewer" : `Show all ${matches.length} providers`}</button>}
      </section>;
    })}
    {query && !providers.some((p) => p.name.toLocaleLowerCase().includes(query)) && <div className="catalog-empty">No providers match “{filter}”.</div>}
  </>;
}

// The provider detail panel: connected, not connected, or not supported by this version.
function ProviderConnection({ providerId }: { providerId: string }) {
  const connections = useConnections();
  const supported = useSupportedProviders();
  if (connections.isPending || supported.isPending) return <StateBlock state="loading" />;
  if (connections.isError || supported.isError) {
    return <StateBlock state="error" code={toProblem(connections.error ?? supported.error).code} action={<Button onClick={() => { void connections.refetch(); void supported.refetch(); }}>Retry</Button>} />;
  }
  if (!supported.data.some((p) => p.id === providerId)) {
    return <div className="state-block"><strong>Not supported yet</strong><p>This version can connect {supported.data.map((p) => p.name).join(", ")}. The full provider catalog comes with SP13.</p></div>;
  }
  const connection = connections.data.find((c) => c.provider === providerId);
  if (!connection) {
    return <div className="state-block"><strong>Not connected</strong><p>Add an API key to route requests to this provider.</p><a className="button button-primary" href={`/providers/connections?provider=${providerId}`}>Add connection</a></div>;
  }
  const pill = statusPill(connection);
  return <div className="list-row"><div><strong>{connection.name}</strong><small>Key <code>{connection.keyHint}</code> · {connection.lastTestedAt ? `tested ${new Date(connection.lastTestedAt).toLocaleString()}` : "not tested yet"}</small></div><Pill tone={pill.tone}>{pill.label}</Pill><a className="button" href="/providers/connections">Manage</a></div>;
}

export function ProviderDetail({ isNew = false, providerId }: { isNew?: boolean; providerId?: string }) {
  const provider = providers.find((item) => item.id === providerId);
  const protocol = new URLSearchParams(window.location.search).get("protocol");
  if (isNew) return <><PageHeading eyebrow="Providers / Custom" title="Add custom provider" description="Define an OpenAI or Anthropic compatible endpoint." />
    <Warning>Custom providers are not available yet. This form is a preview and saves nothing.</Warning>
    <div className="split section-gap"><Panel title="Provider details"><div className="stack"><Field label="Provider name"><Input placeholder="Provider name" /></Field><Field label="Protocol"><select className="input" defaultValue={protocol === "anthropic" ? "anthropic" : "openai"}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic compatible</option></select></Field><Field label="Base URL"><Input placeholder="https://api.example.com/v1" /></Field><Button variant="primary" disabled>Not available yet</Button></div></Panel><Panel title="Connection checklist"><div className="flow-steps">{["Enter provider details", "Validate endpoint", "Add credentials", "Select models"].map((x, i) => <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><strong>{x}</strong></div>)}</div></Panel></div></>;
  if (!provider) return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description="This provider is not in the current catalog." /><Link className="button" to="/providers">Back to providers</Link></>;
  const group = providerGroups.find((item) => item.id === provider.group)!;
  return <><PageHeading eyebrow={`Providers / ${group.title}`} title={provider.name} description="Connection status and credentials for this provider. Models and health arrive with the catalog (SP13)." />
    <div className="grid grid-2"><Panel title="Provider type"><Pill tone="info">{group.title}</Pill><p className="muted">Built-in catalog entry · ID <code>{provider.id}</code></p></Panel><Panel title="Connection"><ProviderConnection providerId={provider.id} /></Panel></div>
  </>;
}

function AddConnection({ requested, connected, onClose, onCreated }: {
  requested: string | null; connected: ReadonlySet<string>; onClose: () => void; onCreated: (connection: Connection) => void;
}) {
  const supported = useSupportedProviders();
  const create = useCreateConnection();
  const showToast = useToast();
  if (supported.isPending) return <Modal title="Add connection" onClose={onClose}><StateBlock state="loading" /></Modal>;
  if (supported.isError) return <Modal title="Add connection" onClose={onClose}><StateBlock state="error" code={toProblem(supported.error).code} action={<Button onClick={() => void supported.refetch()}>Retry</Button>} /></Modal>;
  const available = supported.data.filter((p) => !connected.has(p.id));
  const requestedName = requested && !supported.data.some((p) => p.id === requested) ? (allProviders.find((p) => p.id === requested)?.name ?? requested) : null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formText(event.currentTarget, "name");
    const body = { provider: formText(event.currentTarget, "provider"), apiKey: formText(event.currentTarget, "apiKey"), ...(name ? { name } : {}) };
    create.mutate(body, { onSuccess: onCreated, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  return <Modal title="Add connection" onClose={onClose}>
    {requestedName && <Warning>{requestedName} cannot be connected yet. This version supports {supported.data.map((p) => p.name).join(", ")}.</Warning>}
    {available.length === 0 ? <><p>Every supported provider is already connected. Use Replace key on its row to change a key.</p><div className="modal-actions"><Button onClick={onClose}>Close</Button></div></>
      : <form onSubmit={submit}><p>The key is encrypted before it is saved and is never shown again. AIGate tests it right after saving.</p>
        <div className="stack">
          <Field label="Provider"><select className="input" name="provider" defaultValue={available.some((p) => p.id === requested) ? requested ?? undefined : available[0].id}>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Name" hint="Optional. Defaults to the provider name."><Input name="name" maxLength={64} placeholder="e.g. Work account" /></Field>
          <Field label="API key"><Input name="apiKey" type="password" required minLength={8} maxLength={4096} autoComplete="off" placeholder="sk-…" /></Field>
        </div>
        <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save and test"}</Button></div></form>}
  </Modal>;
}

function ReplaceKey({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: (connection: Connection) => void }) {
  const update = useUpdateConnection();
  const showToast = useToast();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate({ id: connection.id, apiKey: formText(event.currentTarget, "apiKey") }, { onSuccess: onSaved, onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  };
  return <Modal title={`Replace key · ${connection.name}`} onClose={onClose}><form onSubmit={submit}>
    <p>The current key ends in <code>{connection.keyHint}</code>. The new key replaces it and is tested right away.</p>
    <Field label="New API key"><Input name="apiKey" type="password" required minLength={8} maxLength={4096} autoComplete="off" placeholder="sk-…" /></Field>
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
              <div><strong>{c.name}</strong>{c.name !== c.providerName && <small className="muted"> · {c.providerName}</small>}</div>,
              <code>{c.keyHint}</code>,
              <div><Pill tone={pill.tone}>{pill.label}</Pill>{c.isActive && c.testStatus !== "active" && c.lastError && <small className="muted"> {c.lastError}</small>}</div>,
              c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleString() : "Never",
              <><Button variant="ghost" disabled={testConnection.isPending} onClick={() => runTest(c.id)}>{testing(c.id) ? "Testing…" : "Test"}</Button>
                <Button variant="ghost" onClick={() => setReplacing(c)}>Replace key</Button>
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
