import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, PageHeading, Panel, Pill, StateBlock } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useConnections, useCreateNode, useDeleteNode, useProviderNodes, useProviders, useUpdateNode, type ProviderNode } from "./api";

// docs/contracts/custom-providers.md: user-defined OpenAI-compatible endpoints, reached as "<prefix>/<model>".

const text = (form: HTMLFormElement, name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
};
const connectHref = (id: string) => `/providers/connections?provider=${encodeURIComponent(id)}`;

// The server stores these as 9router does (connection.provider-node-create-list); /v1 then never reaches the node.
function unreachable(node: ProviderNode, all: readonly ProviderNode[], reserved: ReadonlySet<string>): string | null {
  if (node.prefix.includes("/")) return `The prefix contains "/", so "<prefix>/<model>" can never match it.`;
  if (reserved.has(node.prefix)) return `"${node.prefix}" is a built-in provider id or alias, which always wins.`;
  const first = all.find((n) => n.prefix === node.prefix);
  return first && first.id !== node.id ? `${first.name} has the same prefix and was added first, so it wins.` : null;
}

export function CustomProviders() {
  const nodes = useProviderNodes();
  const connections = useConnections();
  const catalog = useProviders();
  const reserved = new Set((catalog.data ?? []).flatMap((p) => [p.id, ...p.aliases]));
  const remove = useDeleteNode();
  const showToast = useToast();
  const [removing, setRemoving] = useState<ProviderNode | null>(null);
  const connected = new Set(connections.data?.map((c) => c.provider));
  return <section className="catalog-section"><div className="catalog-section-head"><div><h2>Custom providers {nodes.data && <span className="muted mono">{nodes.data.length}</span>}</h2><p>OpenAI compatible endpoints you define, called as <code>&lt;prefix&gt;/&lt;model&gt;</code>.</p></div><div className="row"><Button disabled>+ Anthropic compatible · SP14</Button><a className="button button-primary" href="/providers/new">+ OpenAI compatible</a></div></div>
    {nodes.isPending ? <StateBlock state="loading" />
      : nodes.isError ? <StateBlock state="error" code={toProblem(nodes.error).code} action={<Button onClick={() => void nodes.refetch()}>Retry</Button>} />
      : nodes.data.length === 0 ? <div className="catalog-empty">No custom providers yet. Add an OpenAI compatible endpoint, such as a local model server.</div>
      : <div className="catalog-grid">{nodes.data.map((node) => <div className="catalog-card" key={node.id}><span className="catalog-glyph" aria-hidden="true">{node.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{node.name}</strong><small><code>{node.prefix}/…</code></small><small title={node.baseUrl} style={{ overflowWrap: "anywhere" }}>{node.baseUrl}</small>
        {(() => { const reason = unreachable(node, nodes.data, reserved); return reason && <><Pill tone="warning">Unreachable</Pill><small>{reason}</small></>; })()}
        {connected.has(node.id) ? <Pill tone="healthy">Connected</Pill> : <a className="button button-ghost" href={connectHref(node.id)}>Connect</a>}
        <a className="button button-ghost" href={`/providers/new?id=${encodeURIComponent(node.id)}`}>Edit</a><Button variant="ghost" onClick={() => setRemoving(node)}>Delete</Button></span></div>)}</div>}
    {removing && <ConfirmDialog name={removing.name} detail={connected.has(removing.id) ? "Its connection and saved API key are deleted too." : undefined} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing.id, {
      onSuccess: () => { setRemoving(null); showToast({ tone: "success", message: `Deleted ${removing.name}.` }); },
      onError: (error) => { setRemoving(null); showToast({ tone: "error", ...toProblem(error) }); },
    })} />}
  </section>;
}

function NodeForm({ node }: { node?: ProviderNode }) {
  const create = useCreateNode();
  const update = useUpdateNode();
  const showToast = useToast();
  const pending = create.isPending || update.isPending;
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const baseUrl = text(event.currentTarget, "baseUrl");
    // An empty base URL is left out, so the server applies the 9router default.
    const fields = { name: text(event.currentTarget, "name"), prefix: text(event.currentTarget, "prefix"), ...(baseUrl ? { baseUrl } : {}) };
    // A new provider goes straight to its API key; an edit applies to the existing connection at once.
    if (!node) create.mutate(fields, { onSuccess: (created) => window.location.assign(connectHref(created.id)), onError: fail });
    else update.mutate({ id: node.id, ...fields }, { onSuccess: () => window.location.assign("/providers"), onError: fail });
  };
  return <form onSubmit={submit}><div className="stack">
    <Field label="Provider name"><Input name="name" required maxLength={64} defaultValue={node?.name} placeholder="e.g. Local LLM" /></Field>
    <Field label="Prefix" hint={'Requests name a model as "<prefix>/<model>", e.g. local/llama-3. A built-in provider id, a prefix already in use, or one containing "/" is saved but unreachable.'}><Input name="prefix" required maxLength={200} defaultValue={node?.prefix} placeholder="local" /></Field>
    <Field label="Protocol"><select className="input" defaultValue="openai" disabled={Boolean(node)}><option value="openai">OpenAI compatible</option><option value="anthropic" disabled>Anthropic compatible (SP14)</option></select></Field>
    <Field label="Base URL" hint="The URL before /chat/completions; empty means https://api.openai.com/v1. https, or http to this machine only."><Input name="baseUrl" maxLength={2048} defaultValue={node?.baseUrl} placeholder="https://api.example.com/v1" /></Field>
    <div className="row"><Link className="button" to="/providers">Cancel</Link><Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : node ? "Save changes" : "Save and add API key"}</Button></div>
  </div></form>;
}

export function CustomProviderForm() {
  const id = new URLSearchParams(window.location.search).get("id");
  const nodes = useProviderNodes();
  const steps = <Panel title="How it works"><div className="flow-steps">{["Save the provider", "Add its API key; AIGate tests it at <base URL>/models", "Call <prefix>/<model> on /v1"].map((x, i) => <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><strong>{x}</strong></div>)}</div></Panel>;
  if (!id) return <><PageHeading eyebrow="Providers / Custom" title="Add custom provider" description="Define an OpenAI compatible endpoint." /><div className="split section-gap"><Panel title="Provider details"><NodeForm /></Panel>{steps}</div></>;
  if (nodes.isPending) return <StateBlock state="loading" />;
  if (nodes.isError) return <StateBlock state="error" code={toProblem(nodes.error).code} action={<Button onClick={() => void nodes.refetch()}>Retry</Button>} />;
  const node = nodes.data.find((n) => n.id === id);
  if (!node) return <><PageHeading eyebrow="Providers / Custom" title="Custom provider not found" description="It may have been deleted." /><Link className="button" to="/providers">Back to providers</Link></>;
  return <><PageHeading eyebrow="Providers / Custom" title={`Edit ${node.name}`} description="Changes apply to its connection at once." /><div className="split section-gap"><Panel title="Provider details"><NodeForm node={node} /></Panel>{steps}</div></>;
}
