import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Field, Input, Metric, Modal, PageHeading, Panel, Pill, Table, Tabs, Warning } from "../../shared/ui";

const providerRows = [
  ["Anthropic", "Claude 3.5 Sonnet, Claude 3.7", "2 connections", "99.98%", "Healthy"],
  ["OpenAI", "GPT-4o, o3, GPT-4o mini", "3 connections", "99.94%", "Healthy"],
  ["Google Vertex", "Gemini 2.5 Pro, Flash", "1 connection", "99.81%", "Healthy"],
  ["DeepSeek", "DeepSeek R1, V3", "2 connections", "98.42%", "Degraded"],
  ["Mistral", "Large, Codestral", "1 connection", "99.92%", "Healthy"],
  ["xAI", "Grok 3, Grok Imagine", "1 connection", "99.76%", "Healthy"],
];

export function LlmProviders() {
  const [filter, setFilter] = useState("");
  const rows = providerRows.filter((r) => r[0].toLowerCase().includes(filter.toLowerCase()));
  return <><PageHeading eyebrow="Providers / Catalog" title="LLM providers" description="Browse models, availability, and connected accounts." action={<Link className="button button-primary" to="/providers/new">+ Add provider</Link>} />
    <div className="grid grid-3"><Metric label="Connected providers" value="12" delta="10 healthy" /><Metric label="Available models" value="186" delta="Across all lanes" /><Metric label="Active connections" value="41" delta="2 need attention" tone="warning" /></div>
    <Panel title="Provider catalog" detail="Configured providers and current availability" className="section-gap panel-flush" action={<Input placeholder="Filter providers…" defaultValue={filter} />}>
      <div className="table-toolbar"><input className="input" aria-label="Filter providers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by provider name" /><Button>All kinds ⌄</Button><Button>Health ⌄</Button></div>
      <Table columns={["Provider", "Models", "Connections", "Success", "Health", ""]} rows={rows.map((r) => [<Link className="table-link" to="/providers/anthropic">{r[0]}</Link>, r[1], r[2], <span className="mono">{r[3]}</span>, <Pill tone={r[4] === "Healthy" ? "healthy" : "warning"}>{r[4]}</Pill>, <Link className="table-link" to="/providers/anthropic">View →</Link>])} />
    </Panel></>;
}

export function ProviderDetail({ isNew = false }: { isNew?: boolean }) {
  const [tab, setTab] = useState("Models");
  return <><PageHeading eyebrow="Providers / Catalog" title={isNew ? "Add provider" : "Anthropic"} description={isNew ? "Connect a provider and select the models it can serve." : "Provider health, models, connection strategy, and credentials."} action={!isNew && <Pill tone="healthy">Healthy</Pill>} />
    {isNew ? <div className="split"><Panel title="Provider details"><div className="stack"><Field label="Provider name"><Input placeholder="Provider name" /></Field><Field label="Protocol"><select className="input"><option>OpenAI compatible</option><option>Anthropic compatible</option></select></Field><Field label="Base URL"><Input placeholder="https://api.example.com/v1" /></Field><Button variant="primary">Continue</Button></div></Panel><Panel title="Connection checklist"><div className="flow-steps">{["Enter provider details", "Validate endpoint", "Add credentials", "Select models"].map((x, i) => <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><strong>{x}</strong></div>)}</div></Panel></div> : <>
      <div className="grid grid-4"><Metric label="Requests 24h" value="245,821" delta="↗ +12.3%" /><Metric label="Success rate" value="99.98%" delta="Healthy" /><Metric label="p95 latency" value="940ms" delta="Within target" /><Metric label="Connections" value="2" delta="Both active" /></div>
      <div className="section-gap"><Tabs items={["Models", "Connections", "Mapping", "Usage"]} active={tab} onChange={setTab} /></div>
      {tab === "Models" && <Panel title="Available models" className="section-gap panel-flush" action={<Button>Manage models</Button>}><Table columns={["Model ID", "Kind", "Context", "Status"]} rows={[["claude-3.5-sonnet", "Chat", "200K", "Enabled"],["claude-3.7-sonnet", "Chat", "200K", "Enabled"],["claude-3-opus", "Chat", "200K", "Disabled"]].map((r) => [<code>{r[0]}</code>, r[1], <span className="mono">{r[2]}</span>, <Pill tone={r[3] === "Enabled" ? "healthy" : "muted"}>{r[3]}</Pill>])} /></Panel>}
      {tab === "Connections" && <Panel title="Connected accounts" className="section-gap"><div className="list-row"><Dot /><div><strong>Anthropic primary</strong><small>OAuth · token healthy · last used 2 minutes ago</small></div><Pill tone="healthy">Active</Pill></div><div className="list-row"><Dot /><div><strong>Anthropic secondary</strong><small>API key · standby</small></div><Pill tone="healthy">Active</Pill></div></Panel>}
      {tab === "Mapping" && <Panel title="Model aliases" className="section-gap"><CopyField label="Public alias" value="claude-default → anthropic/claude-3.5-sonnet" /></Panel>}
      {tab === "Usage" && <Panel title="Usage by model" className="section-gap"><Metric label="Tokens 24h" value="41.2M" delta="Across 2 models" /></Panel>}
    </>}
  </>;
}

export function Connections() {
  const [tab, setTab] = useState("All accounts");
  const [flowOpen, setFlowOpen] = useState(false);
  return <><PageHeading eyebrow="Providers / Connections" title="Connections" description="Accounts, credentials, refresh status, and selection order." action={<Button variant="primary" onClick={() => setFlowOpen(true)}>+ Add connection</Button>} />
    <Warning>Secrets are never shown after they are saved. Replace a credential to rotate it.</Warning>
    <div className="section-gap"><Tabs items={["All accounts", "Needs attention", "Strategies"]} active={tab} onChange={setTab} /></div>
    {tab === "Strategies" ? <div className="grid grid-2 section-gap"><Panel title="Account selection"><Field label="Default strategy"><select className="input"><option>Fill first</option><option>Round robin</option><option>Sticky</option></select></Field></Panel><Panel title="Health checks"><div className="list-row"><div><strong>Proactive refresh</strong><small>Refresh credentials before expiry.</small></div><input type="checkbox" defaultChecked aria-label="Proactive refresh" /></div></Panel></div> :
      <Panel title={tab === "Needs attention" ? "Connections requiring action" : "Connected accounts"} className="section-gap panel-flush">
        <Table columns={["Provider / Account", "Auth", "Quota", "Last used", "Status", ""]} rows={(tab === "Needs attention" ? ["DeepSeek"] : ["Anthropic", "OpenAI", "Google Vertex", "DeepSeek"]).map((name, i) => [<strong>{name} primary</strong>, i === 0 ? "OAuth" : "API key", <span className="mono">{i === 3 ? "82%" : "42%"}</span>, `${i + 2}m ago`, <Pill tone={name === "DeepSeek" ? "warning" : "healthy"}>{name === "DeepSeek" ? "Refresh" : "Active"}</Pill>, <Button variant="ghost" onClick={() => setFlowOpen(true)}>Manage</Button>])} />
      </Panel>}
    {flowOpen && <Modal title="Add connection" onClose={() => setFlowOpen(false)}><p>Choose a provider and authentication method. The form changes with the provider contract.</p><div className="stack"><Field label="Provider"><select className="input"><option>Anthropic</option><option>OpenAI</option><option>Google Vertex</option></select></Field><Field label="Method"><select className="input"><option>API key</option><option>OAuth</option></select></Field><Field label="Credential"><Input type="password" placeholder="Enter a new key" /></Field></div><div className="modal-actions"><Button onClick={() => setFlowOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setFlowOpen(false)}>Continue</Button></div></Modal>}
  </>;
}

export function Quota() {
  const rows = [["Anthropic primary", "Claude Sonnet", 83, "3h 24m"], ["OpenAI primary", "GPT-4o", 54, "1h 18m"], ["Google Vertex", "Gemini Pro", 31, "Tomorrow"], ["DeepSeek primary", "DeepSeek R1", 92, "43m"]] as const;
  return <><PageHeading eyebrow="Providers / Quota" title="Quota tracker" description="Usage limits and reset windows for connected accounts." action={<Button>Refresh quotas</Button>} />
    <div className="grid grid-3"><Metric label="Healthy quotas" value="38" delta="Across 41 accounts" /><Metric label="Near limit" value="2" delta="Action recommended" tone="warning" /><Metric label="Exhausted" value="1" delta="Resets in 43 min" tone="danger" /></div>
    <Panel title="Account limits" detail="Live and cached provider quota signals" className="section-gap"><div className="stack">{rows.map(([name, model, used, reset]) => <div className="quota-row" key={name}><div className="row between"><strong>{name}</strong><span className="muted mono">{used}% used</span></div><small>{model} · resets {reset}</small><div className={`progress ${used > 85 ? "danger" : used > 75 ? "warning" : ""}`}><span style={{ width: `${used}%` }} /></div></div>)}</div></Panel>
  </>;
}

export function MediaProviders({ detail = false }: { detail?: boolean }) {
  const kinds = ["Image generation", "Image understanding", "Text to speech", "Speech to text", "Video", "Web search", "Web fetch", "Embeddings", "Music"];
  return <><PageHeading eyebrow="Providers / Media" title={detail ? "Video providers" : "Media providers"} description="Configure providers for non-chat capabilities and inspect supported lanes." action={<Button variant="primary">+ Connect provider</Button>} />
    <div className="grid grid-3">{(detail ? ["xAI", "RunwayML", "Vertex AI"] : kinds).map((kind, i) => <Link to={detail ? "/providers/media/video/xai" : "/providers/media/video"} className="media-card" key={kind}><div className="row between"><span className="media-icon">{["▧", "◈", "◖", "◎", "▸", "⌕", "↗", "▥", "♫"][i]}</span><Pill tone={i === 8 || (detail && i === 1) ? "muted" : "healthy"}>{i === 8 ? "No provider" : "Available"}</Pill></div><strong>{kind}</strong><small>{detail ? "Inspect models and connection status" : `${i + 1} configured models`}</small></Link>)}</div>
    {detail && <Panel title="Video lane" className="section-gap"><Warning>Models shown as video capable must be routable through this lane.</Warning><div className="list-row"><Dot /><div><strong>xAI · grok-imagine-video</strong><small>Creation and polling supported</small></div><Pill tone="healthy">Ready</Pill></div></Panel>}
  </>;
}

