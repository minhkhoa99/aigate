import { useState } from "react";
import { Button, ConfirmDialog, CopyField, Dot, Field, Input, Metric, Modal, PageHeading, Panel, Pill, Table, Tabs, Warning } from "../../shared/ui";

const keyRows = [
  ["Default Dev Token", "sk-proj-••••-8f21", "2026-08-12", "2m ago", "Active"],
  ["CI Pipeline", "sk-proj-••••-91a8", "2026-08-19", "14m ago", "Active"],
  ["Staging Environment", "sk-proj-••••-0d2e", "2026-08-20", "4d ago", "Disabled"],
];

export function EndpointKeys() {
  const [showCreate, setShowCreate] = useState(false);
  const [revoke, setRevoke] = useState<string | null>(null);
  return <>
    <PageHeading eyebrow="Gateway / Endpoint & Keys" title="Gateway endpoints" description="Configure your client base URL and manage access tokens." />
    <Panel title="Base URL" detail="Use this URL in OpenAI-compatible clients." action={<Pill tone="healthy">Listening</Pill>}>
      <CopyField label="OpenAI compatible endpoint" value="http://localhost:20128/v1" />
      <div className="endpoint-examples"><span>OpenAI</span><span>Anthropic</span><span>Gemini</span><span>Codex</span></div>
      <CopyField label="Terminal example" value="export OPENAI_BASE_URL=http://localhost:20128/v1" />
    </Panel>
    <Panel title="API keys" detail="Manage scoped gateway tokens for upstream client authentication." className="section-gap panel-flush" action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create key</Button>}>
      <Table columns={["Name", "Masked key", "Created", "Last used", "Status", "Actions"]} rows={keyRows.map((r) => [r[0], <code>{r[1]}</code>, r[2], r[3], <Pill tone={r[4] === "Active" ? "healthy" : "muted"}>{r[4]}</Pill>, <Button variant="ghost" onClick={() => setRevoke(r[0])}>Revoke</Button>])} />
    </Panel>
    <Panel title="Security settings" detail="Protect this gateway from requests without a valid key." className="section-gap">
      <div className="list-row"><div><strong>Require API key</strong><small>Requests without a valid key are rejected.</small></div><input type="checkbox" defaultChecked aria-label="Require API key" /></div>
      <div className="list-row"><div><strong>Reject legacy keys</strong><small>New keys use a versioned format with machine binding.</small></div><input type="checkbox" aria-label="Reject legacy keys" /></div>
    </Panel>
    {showCreate && <Modal title="Create API key" onClose={() => setShowCreate(false)}>
      <p>Give this key a name. Its value will be shown once after issuance.</p><Field label="Name"><Input placeholder="e.g. Local development" /></Field><div className="modal-actions"><Button onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" onClick={() => setShowCreate(false)}>Create key</Button></div>
    </Modal>}
    {revoke && <ConfirmDialog name={revoke} onClose={() => setRevoke(null)} onConfirm={() => setRevoke(null)} />}
  </>;
}

export function Routing() {
  const [tab, setTab] = useState("Overview");
  return <>
    <PageHeading eyebrow="Gateway / Routing" title="Routing & fallback" description="Decide where traffic goes, when to retry, and how to recover from failure." action={<Button variant="primary">+ Create combo</Button>} />
    <Tabs items={["Overview", "Fallback", "Capacity adapter", "Simulator"]} active={tab} onChange={setTab} />
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

