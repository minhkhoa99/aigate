import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { Button, ConfirmDialog, CopyField, Dot, Field, Input, Metric, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useApiKeys, useChatReadiness, useCreateKey, useDeleteKey, useRequireApiKey, useSetKeyActive, useSetRequireApiKey, type ApiKey, type ChatReadiness, type CreatedApiKey } from "./api";

const READINESS: Record<ChatReadiness, { tone: "healthy" | "warning"; label: string; hint?: string }> = {
  ready: { tone: "healthy", label: "Ready" },
  "no-connection": { tone: "warning", label: "Connect a provider", hint: "The chat API answers once a provider is connected." },
  "check-connection": { tone: "warning", label: "Check connection", hint: "A provider is connected, but its key has not passed a test yet." },
};
const SAMPLE_BODY = JSON.stringify({ model: "openai/gpt-4.1-mini", messages: [{ role: "user", content: "Hello" }] });

export function EndpointKeys() {
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);
  const keys = useApiKeys();
  const createKey = useCreateKey();
  const setActive = useSetKeyActive();
  const deleteKey = useDeleteKey();
  const requireApiKey = useRequireApiKey();
  const setRequireApiKey = useSetRequireApiKey();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  // The chat API (docs/contracts/chat-lane.md) on this origin.
  const baseUrl = `${window.location.origin}/v1`;
  const readiness = useChatReadiness();
  const state = readiness.data ? READINESS[readiness.data] : undefined;
  const curl = `curl ${baseUrl}/chat/completions -H "Authorization: Bearer <your AIGate key>" -H "Content-Type: application/json" -d '${SAMPLE_BODY}'`;
  const closeCreate = () => { setShowCreate(false); setCreated(null); createKey.reset(); };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    createKey.mutate(typeof name === "string" ? name : "", { onSuccess: setCreated, onError: fail });
  };

  return <>
    <PageHeading eyebrow="Gateway / Endpoint & Keys" title="Gateway endpoints" description="Configure your client base URL and manage access tokens." />
    <Panel title="Base URL" detail="Use this URL in OpenAI-compatible clients." action={state ? <Pill tone={state.tone}>{state.label}</Pill> : <Pill>{readiness.isError ? "Status unavailable" : "Checking…"}</Pill>}>
      {state?.hint && <Warning>{state.hint} <a href="/providers/connections">Open Connections</a></Warning>}
      <CopyField label="OpenAI compatible endpoint" value={baseUrl} />
      <div className="endpoint-examples"><span>OpenAI</span></div>
      <p className="muted">Anthropic, Gemini, and Codex formats arrive with SP15. List models at <code>/v1/models</code>, or send <code>provider/model</code> such as <code>openai/gpt-4.1-mini</code>.</p>
      <CopyField label="Terminal example" value={`export OPENAI_BASE_URL=${baseUrl}`} />
      <CopyField label="Test request" value={curl} />
    </Panel>
    <Panel title="API keys" detail="Manage scoped gateway tokens for upstream client authentication." className="section-gap panel-flush" action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create key</Button>}>
      {keys.isPending ? <StateBlock state="loading" />
        : keys.isError ? <StateBlock state="error" code={toProblem(keys.error).code} action={<Button onClick={() => void keys.refetch()}>Retry</Button>} />
        : <Table empty="No API keys yet. Create one for each client." columns={["Name", "Masked key", "Created", "Status", "Actions"]} rows={keys.data.map((key) => [
          key.name, <code>{key.maskedKey}</code>, new Date(key.createdAt).toLocaleDateString(),
          <Pill tone={key.isActive ? "healthy" : "muted"}>{key.isActive ? "Active" : "Disabled"}</Pill>,
          <><Button variant="ghost" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: key.id, isActive: !key.isActive }, { onError: fail })}>{key.isActive ? "Disable" : "Enable"}</Button>
            <Button variant="ghost" onClick={() => setRevoke(key)}>Revoke</Button></>,
        ])} />}
    </Panel>
    <Panel title="Security settings" detail="Protect this gateway from requests without a valid key." className="section-gap">
      <div className="list-row"><div><strong>Require API key</strong><small>Requests without a valid key are rejected. When off, only this machine can call the chat API.</small></div><input type="checkbox" checked={requireApiKey.data ?? true} disabled={requireApiKey.data === undefined || setRequireApiKey.isPending} onChange={(e) => setRequireApiKey.mutate(e.target.checked, { onError: fail })} aria-label="Require API key" /></div>
    </Panel>
    {showCreate && <Modal title="Create API key" onClose={closeCreate}>
      {created ? <><Warning>Copy this key now. It is shown only once and cannot be recovered.</Warning><CopyField label={created.name} value={created.key} /><div className="modal-actions"><Button variant="primary" onClick={closeCreate}>Done</Button></div></>
        : <form onSubmit={submitCreate}><p>Give this key a name. Its value will be shown once after issuance.</p><Field label="Name"><Input name="name" required maxLength={64} placeholder="e.g. Local development" /></Field><div className="modal-actions"><Button onClick={closeCreate}>Cancel</Button><Button type="submit" variant="primary" disabled={createKey.isPending}>{createKey.isPending ? "Creating…" : "Create key"}</Button></div></form>}
    </Modal>}
    {revoke && <ConfirmDialog name={revoke.name} onClose={() => setRevoke(null)} onConfirm={() => deleteKey.mutate(revoke.id, {
      onSuccess: () => { setRevoke(null); showToast({ tone: "success", message: `Revoked ${revoke.name}.` }); },
      onError: (error) => { setRevoke(null); fail(error); },
    })} />}
  </>;
}

export function Routing() {
  const [tab, setTab] = useState("Combo");
  return <>
    <PageHeading eyebrow="Gateway / Routing" title="Routing & fallback" description="Decide where traffic goes, when to retry, and how to recover from failure." action={<Link to="/gateway/routing/new" className="button button-primary">+ Create combo</Link>} />
    <Tabs items={["Combo", "Overview", "Fallback", "Capacity adapter", "Simulator"]} active={tab} onChange={setTab} />
    {tab === "Combo" && <Panel title="Combos" detail="Saved model combinations will appear here after gateway integration." className="section-gap"><div className="state-block"><strong>No combos yet</strong><p>Start with a model order and routing strategy.</p><Link to="/gateway/routing/new" className="button button-primary">Create combo</Link></div></Panel>}
    {tab === "Overview" && <div className="grid grid-2 section-gap"><Panel title="Active routes" detail="Current model resolution order">
      {["claude-3.5-sonnet → Anthropic primary", "gpt-4o → OpenAI primary", "gemini-2.5-pro → Google Vertex", "deepseek-r1 → DeepSeek pooled"].map((r, i) => <div className="list-row" key={r}><Dot tone={i === 3 ? "warning" : "healthy"} /><div><strong className="mono">{r}</strong><small>{i === 3 ? "Fallback available" : "Direct · healthy"}</small></div><Pill tone={i === 3 ? "warning" : "healthy"}>{i === 3 ? "Guarded" : "Active"}</Pill></div>)}
    </Panel><Panel title="Decision path" detail="Single request, from client to provider"><div className="flow-steps">{["Validate API key", "Resolve alias & capability", "Choose connection", "Translate request", "Dispatch with timeout", "Stream response"].map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, "0")}</span><strong>{s}</strong><Dot /></div>)}</div></Panel></div>}
    {tab === "Fallback" && <div className="stack section-gap"><Warning>Request-caused errors return directly to the client. Account fallback is reserved for recoverable provider failures.</Warning><Panel title="Fallback policy" detail="The first healthy route that can serve the request wins."><Table columns={["Condition", "Action", "Lock", "Status"]} rows={[
      ["Invalid request · 400", "Return to client", "None", <Pill tone="healthy">Terminal</Pill>],
      ["Rate limit · 429", "Next account", "Exponential", <Pill tone="warning">Fallback</Pill>],
      ["Provider outage · 503", "Retry, then next route", "30 seconds", <Pill tone="warning">Fallback</Pill>],
      ["Client abort · 499", "Cancel upstream", "None", <Pill tone="healthy">Terminal</Pill>],
    ]} /></Panel></div>}
    {tab === "Capacity adapter" && <div className="grid grid-2 section-gap"><Panel title="Strategy"><Field label="Distribution"><select className="input" defaultValue="fill"><option value="fill">Fill first</option><option value="round">Round robin</option><option value="sticky">Sticky</option></select></Field><div className="list-row"><div><strong>Concurrent request limit</strong><small>Bound panel fan-out before dispatch.</small></div><Input type="number" defaultValue="8" /></div></Panel><Panel title="Current capacity"><Metric label="Available connections" value="41 / 80" delta="51% headroom" bars={[24,38,45,52,58,72,65,54,40,45]} /></Panel></div>}
    {tab === "Simulator" && <div className="split section-gap"><Panel title="Test a route" detail="Preview decisions without sending a provider request"><div className="stack"><Field label="Model"><Input defaultValue="claude-3.5-sonnet" /></Field><Field label="Input tokens"><Input type="number" defaultValue="2048" /></Field><Button variant="primary">Run simulation</Button></div></Panel><Panel title="Expected route"><div className="flow-steps"><div><span>01</span><strong>Anthropic primary</strong><Pill tone="healthy">Selected</Pill></div><div><span>02</span><strong>Anthropic secondary</strong><Pill>Standby</Pill></div></div></Panel></div>}
  </>;
}

export function TokenSaver() {
  return <>
    <PageHeading eyebrow="Gateway / Token Saver" title="Token Saver" description="Reduce token usage without changing the meaning of a request." action={<Pill tone="healthy">Enabled</Pill>} />
    <div className="grid grid-3"><Metric label="Tokens saved 24h" value="182.4K" delta="12.8% of eligible traffic" bars={[20,29,32,45,41,58,65,61,73,81]} /><Metric label="Requests optimized" value="12,481" delta="↗ +6.2%" /><Metric label="Average reduction" value="14.6%" delta="Across enabled stages" /></div>
    <Warning tone="warning">A request with <code>x-9router-token-saver: off</code> must bypass every optimization stage, including PXPIPE.</Warning>
    <Panel title="Optimization pipeline" detail="Stages run in order. Each stage may be disabled independently." className="section-gap"><div className="pipeline">{["RTK", "Headroom", "Caveman", "Ponytail", "PXPIPE"].map((name, i) => <div key={name}><span>{String(i + 1).padStart(2, "0")}</span><strong>{name}</strong><Pill tone="healthy">Enabled</Pill></div>)}</div></Panel>
    <Panel title="Stage controls" className="section-gap">{["RTK · tool response compression", "Headroom · context reduction", "Caveman · concise transforms", "Ponytail · low-cost rewrites", "PXPIPE · image block extraction"].map((name) => <div className="list-row" key={name}><div><strong>{name}</strong><small>Runs only when the master Token Saver switch allows it.</small></div><input type="checkbox" defaultChecked aria-label={`Enable ${name}`} /></div>)}</Panel>
  </>;
}
