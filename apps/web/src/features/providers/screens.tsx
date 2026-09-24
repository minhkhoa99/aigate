import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Field, Input, Metric, Modal, PageHeading, Panel, Pill, Table, Tabs, Warning } from "../../shared/ui";
import { allProviders, mediaGroups, mediaOnlyProviders, providerGroups, providers } from "./catalog";

export function LlmProviders() {
  const [filter, setFilter] = useState("");
  const [showAllKeys, setShowAllKeys] = useState(false);
  const query = filter.trim().toLocaleLowerCase();
  return <><PageHeading eyebrow="Providers / Catalog" title="LLM providers" description="Browse built-in providers by connection method. Connection state appears after backend integration." />
    <div className="provider-catalog-toolbar"><input className="input" aria-label="Search providers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${providers.length} providers…`} /><span className="muted mono">{providers.filter((p) => p.name.toLocaleLowerCase().includes(query)).length} / {providers.length} built-in</span></div>
    {!query && <section className="catalog-section"><div className="catalog-section-head"><div><h2>Custom providers</h2><p>OpenAI or Anthropic compatible endpoints you define.</p></div><div className="row"><a className="button" href="/providers/new?protocol=anthropic">+ Anthropic compatible</a><a className="button button-primary" href="/providers/new?protocol=openai">+ OpenAI compatible</a></div></div><div className="catalog-empty">No custom providers in this UI preview.</div></section>}
    {providerGroups.map((group) => {
      const matches = group.providers.filter(([, name]) => name.toLocaleLowerCase().includes(query));
      if (!matches.length) return null;
      const visible = group.id === "apikey" && !query && !showAllKeys ? matches.slice(0, 20) : matches;
      return <section className="catalog-section" key={group.id} aria-labelledby={`${group.id}-heading`}><div className="catalog-section-head"><div><h2 id={`${group.id}-heading`}>{group.title} <span className="muted mono">{matches.length}</span></h2><p>{group.id === "oauth" ? "Account sign-in and token based connections." : group.id === "free" ? "Providers listed under Free Tier in the 9Router reference; access terms vary." : group.id === "webCookie" ? "Subscription account connections; provider-specific setup is pending." : "Connect with a provider-issued API key."}</p></div></div>
        <div className="catalog-grid">{visible.map(([id, name]) => <a className="catalog-card" href={`/providers/detail?provider=${id}`} key={id}><span className="catalog-glyph" aria-hidden="true">{name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{name}</strong><small>View provider →</small></span></a>)}</div>
        {group.id === "apikey" && !query && <button className="catalog-more" type="button" onClick={() => setShowAllKeys(!showAllKeys)}>{showAllKeys ? "Show fewer" : `Show all ${matches.length} providers`}</button>}
      </section>;
    })}
    {query && !providers.some((p) => p.name.toLocaleLowerCase().includes(query)) && <div className="catalog-empty">No providers match “{filter}”.</div>}
  </>;
}

export function ProviderDetail({ isNew = false, providerId }: { isNew?: boolean; providerId?: string }) {
  const provider = providers.find((item) => item.id === providerId);
  const protocol = new URLSearchParams(window.location.search).get("protocol");
  if (isNew) return <><PageHeading eyebrow="Providers / Custom" title="Add custom provider" description="Define an OpenAI or Anthropic compatible endpoint." />
    <div className="split"><Panel title="Provider details"><div className="stack"><Field label="Provider name"><Input placeholder="Provider name" /></Field><Field label="Protocol"><select className="input" defaultValue={protocol === "anthropic" ? "anthropic" : "openai"}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic compatible</option></select></Field><Field label="Base URL"><Input placeholder="https://api.example.com/v1" /></Field><Button variant="primary" disabled>Continue after backend integration</Button></div></Panel><Panel title="Connection checklist"><div className="flow-steps">{["Enter provider details", "Validate endpoint", "Add credentials", "Select models"].map((x, i) => <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><strong>{x}</strong></div>)}</div></Panel></div></>;
  if (!provider) return <><PageHeading eyebrow="Providers / Catalog" title="Provider not found" description="This provider is not in the current catalog." /><Link className="button" to="/providers">Back to providers</Link></>;
  const group = providerGroups.find((item) => item.id === provider.group)!;
  return <><PageHeading eyebrow={`Providers / ${group.title}`} title={provider.name} description="Connection setup, models, and health will appear here when provider integration is available." action={<a className="button button-primary" href={`/providers/connections?provider=${provider.id}`}>+ Add connection</a>} />
    <div className="grid grid-2"><Panel title="Provider type"><Pill tone="info">{group.title}</Pill><p className="muted">Built-in catalog entry · ID <code>{provider.id}</code></p></Panel><Panel title="Connections"><div className="state-block"><strong>No AIGate connection data yet</strong><p>Use Add connection to preview the setup form. Saving credentials requires backend integration.</p></div></Panel></div>
  </>;
}

export function Connections() {
  const [tab, setTab] = useState("All accounts");
  const requestedProvider = new URLSearchParams(window.location.search).get("provider");
  const [flowOpen, setFlowOpen] = useState(Boolean(requestedProvider));
  const [providerId, setProviderId] = useState(allProviders.some((p) => p.id === requestedProvider) ? requestedProvider! : providers[0].id);
  const selectedProvider = allProviders.find((p) => p.id === providerId)!;
  return <><PageHeading eyebrow="Providers / Connections" title="Connections" description="Accounts, credentials, refresh status, and selection order." action={<Button variant="primary" onClick={() => setFlowOpen(true)}>+ Add connection</Button>} />
    <Warning>Account rows below are sample data. No provider credential is saved by this UI preview.</Warning>
    <div className="section-gap"><Tabs items={["All accounts", "Needs attention", "Strategies"]} active={tab} onChange={setTab} /></div>
    {tab === "Strategies" ? <div className="grid grid-2 section-gap"><Panel title="Account selection"><Field label="Default strategy"><select className="input"><option>Fill first</option><option>Round robin</option><option>Sticky</option></select></Field></Panel><Panel title="Health checks"><div className="list-row"><div><strong>Proactive refresh</strong><small>Refresh credentials before expiry.</small></div><input type="checkbox" defaultChecked aria-label="Proactive refresh" /></div></Panel></div> :
      <Panel title={tab === "Needs attention" ? "Connections requiring action" : "Connected accounts"} className="section-gap panel-flush">
        <Table columns={["Provider / Account", "Auth", "Quota", "Last used", "Status", ""]} rows={(tab === "Needs attention" ? ["DeepSeek"] : ["Anthropic", "OpenAI", "Google Vertex", "DeepSeek"]).map((name, i) => [<strong>{name} primary</strong>, i === 0 ? "OAuth" : "API key", <span className="mono">{i === 3 ? "82%" : "42%"}</span>, `${i + 2}m ago`, <Pill tone={name === "DeepSeek" ? "warning" : "healthy"}>{name === "DeepSeek" ? "Refresh" : "Active"}</Pill>, <span className="muted">Demo</span>])} />
      </Panel>}
    {flowOpen && <Modal title="Add connection" onClose={() => setFlowOpen(false)}><p>Preview the setup for a built-in provider. Credentials cannot be saved yet.</p><div className="stack"><Field label="Provider"><select className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>{providerGroups.map((group) => <optgroup key={group.id} label={group.title}>{group.providers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</optgroup>)}<optgroup label="Media-only providers">{mediaOnlyProviders.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</optgroup></select></Field><div className="list-row"><div><strong>Connection method</strong><small>{selectedProvider.group === "oauth" ? "OAuth sign-in" : selectedProvider.group === "apikey" ? "Provider-issued API key" : selectedProvider.group === "webCookie" ? "Subscription account session" : "Provider-specific setup; details pending integration"}</small></div></div>{selectedProvider.group === "apikey" ? <Field label="Credential"><Input type="password" placeholder="Available after backend integration" disabled /></Field> : <div className="warning">{selectedProvider.group === "oauth" ? "OAuth authorization" : "Provider-specific authentication"} will open here after backend integration.</div>}</div><div className="modal-actions"><Button onClick={() => setFlowOpen(false)}>Close</Button><Button variant="primary" disabled>Continue</Button></div></Modal>}
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
