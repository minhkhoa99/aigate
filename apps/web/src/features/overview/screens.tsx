import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useLiveUsage } from "../../shared/live-usage";
import { useOverview } from "./api";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2, maximumFractionDigits: 4 })}`;
const rate = (errors: number, requests: number) => requests ? errors / requests * 100 : 0;
const delta = (current: number, previous: number) => previous === 0 ? (current === 0 ? "No change · previous 24h also zero" : "No previous 24h baseline") : `${current >= previous ? "+" : ""}${((current - previous) / previous * 100).toFixed(1)}% vs previous 24h`;
const bars = (values: number[]) => { const max = Math.max(...values) || 1; return values.map((value) => value / max * 100); };
const TONES = { unknown: "muted", healthy: "healthy", degraded: "warning", down: "danger", success: "healthy", error: "danger", aborted: "warning" } as const;

export function Overview() {
  const summary = useOverview();
  const { live, connected, stopped, reconnect } = useLiveUsage();
  const data = summary.data;
  const writer = connected ? live?.writer ?? data?.writer : data?.writer;
  const names = new Map(data?.providers.map((row) => [row.provider, row.name]) ?? []);
  return <>
    <PageHeading eyebrow="Workspace / Overview" title="Gateway overview" description="Traffic, health, and exceptions across your local AI gateway · last 24 hours."
      action={<Button onClick={() => { void summary.refetch(); }} disabled={summary.isFetching}>Refresh</Button>} />
    {summary.error ? <div className="state-block error"><code>{toProblem(summary.error).code}</code><strong>Could not load overview</strong><p>{toProblem(summary.error).message}</p><Button onClick={() => { void summary.refetch(); }}>Retry</Button></div>
      : !data ? <StateBlock state="loading" /> : <>
    <div className="status-strip overview-status"><div className="row"><Pill tone="healthy">Running</Pill><span className="target-label">Endpoint:</span><CopyField value={`${window.location.origin}/v1`} /></div>
      <div className="row muted"><span>Uptime: {Math.floor(data.uptimeSeconds / 3600)}h {Math.floor(data.uptimeSeconds % 3600 / 60)}m</span><span>Enabled accounts: {data.enabledConnections}</span><span>Upstream calls in flight: {connected && live ? live.active.reduce((sum, row) => sum + row.count, 0) : "—"}</span></div></div>
    <p className="muted">Updated {new Date(data.at).toLocaleTimeString("en-US", { timeZone: data.timezone })} · {data.timezone}. Request counts are client requests; tokens and cost include their upstream attempts.</p>
    {writer && (writer.dropped > 0 || writer.failed > 0) && <Warning tone="danger">Usage recording lost data: {writer.dropped} dropped events/requests and {writer.failed} failed batches since startup. Figures may be incomplete; check the server log.</Warning>}
    <div className="grid grid-4 section-gap">
      <Metric label="Requests 24h" value={data.current.requests.toLocaleString("en-US")} delta={delta(data.current.requests, data.previous.requests)} bars={bars(data.buckets.map((row) => row.requests))} />
      <Metric label="Tokens 24h" value={compact.format(data.current.tokens)} delta={delta(data.current.tokens, data.previous.tokens)} bars={bars(data.buckets.map((row) => row.tokens))} tone="info" />
      <Metric label="Estimated cost 24h" value={money(data.current.cost)} delta={data.current.unpriced || data.previous.unpriced ? `${data.current.unpriced} unpriced attempts now, ${data.previous.unpriced} previously · partial cost` : delta(data.current.cost, data.previous.cost)} bars={bars(data.buckets.map((row) => row.cost))} tone={data.current.unpriced ? "warning" : "healthy"} />
      <Metric label="Error rate 24h" value={data.current.requests ? `${rate(data.current.errors, data.current.requests).toFixed(1)}%` : "—"}
        delta={data.current.requests && data.previous.requests ? `${(rate(data.current.errors, data.current.requests) - rate(data.previous.errors, data.previous.requests)).toFixed(1)} percentage points vs previous 24h` : "Not enough requests to compare"}
        bars={bars(data.buckets.map((row) => rate(row.errors, row.requests)))} tone={data.current.errors ? "warning" : "healthy"} />
    </div>
    {data.current.requests === 0 && <Panel title="No traffic in the last 24 hours" className="section-gap"><p className="muted">Connect a provider and configure a client to send its first request. Recording appears after the next usage flush.</p><div className="row"><Link to="/providers/connections" className="button">Connections</Link><Link to="/integrations/cli-tools" className="button button-primary">Configure a CLI tool</Link></div></Panel>}
    <div className="split section-gap">
      <Panel title="Live requests" detail="20 most recent upstream attempts since startup" className="panel-flush" action={<div className="row"><Pill tone={connected ? "healthy" : stopped ? "danger" : "warning"}>{connected ? "Live" : stopped ? "Stopped" : "Reconnecting"}</Pill><Link to="/traffic/requests" className="button button-ghost">View all →</Link></div>}>
        {stopped && <Warning tone="danger"><code>{stopped.code}</code> · {stopped.message} <Button onClick={reconnect}>Reconnect</Button></Warning>}
        {!connected && live && <p className="muted">Showing the last received attempts. Live counts are unavailable until the connection resumes.</p>}
        <Table columns={["Time", "Model ID", "Provider", "TTFT", "Tokens", "Status"]} empty="No upstream attempt recorded since startup." rows={(live?.recent ?? []).slice(0, 20).map((row) => [
          <Link to="/traffic/requests/detail" search={{ id: row.requestId }}><code>{new Date(row.at).toLocaleTimeString("en-US", { timeZone: data.timezone })}</code></Link>,
          <code>{row.model}</code>, names.get(row.provider) ?? row.provider, <span className="mono">{row.ttftMs === null ? "—" : `${row.ttftMs}ms`}</span>,
          <span className="mono">{compact.format(row.inputTokens + row.outputTokens)}{row.estimated ? " ≈" : ""}</span>, <Pill tone={TONES[row.status]}>{row.errorCode ?? row.status}</Pill>,
        ])} />
      </Panel>
      <Panel title="Needs attention" detail="Enabled accounts · current locks, last tests and cached quota" action={<Pill tone={data.attention.length ? "warning" : "muted"}>{data.attention.length}{data.attentionTruncated ? "+" : ""} alerts</Pill>}>
        <div className="attention-list">{data.attention.map((alert) => <Warning key={alert.id} tone={alert.tone}><strong>{names.get(alert.provider) ?? alert.provider} · {alert.name}</strong><small>{alert.message}</small>
          {alert.until !== null && <small>{alert.kind === "expiry" ? "Token expiry" : "Last lock ends"}: {new Date(alert.until).toLocaleString("en-US", { timeZone: data.timezone })}</small>}
          <Link to={alert.kind === "quota" ? "/providers/quota" : "/providers/connections"}>{alert.kind === "quota" ? "Review quota →" : "Review connection →"}</Link></Warning>)}</div>
        {data.attention.length === 0 && <p className="muted">No current account alert in the available readings.</p>}
        <p className="muted">Fresh quota readings: {data.quotaChecked} of {data.enabledConnections} enabled accounts. Unchecked accounts have unknown quota. <Link to="/providers/quota">Check quota →</Link></p>
        {data.attentionTruncated && <p className="muted">Showing the first 100 alerts. Review Connections and Quota for all accounts.</p>}
      </Panel>
    </div>
    <Panel title="Provider health" detail="Last hour upstream attempts · errors include failed fallbacks · observed traffic, not a probe" className="section-gap" action={<Link to="/providers/connections" className="button button-ghost">Connections →</Link>}>
      <div className="provider-grid">{data.providers.map((provider) => <div className="provider-tile" key={provider.provider}><div><strong>{provider.name}</strong><Dot tone={TONES[provider.health]} /></div>
        <small>{provider.health} · {provider.errorRate === null ? "no recent attempts" : `${(provider.errorRate * 100).toFixed(1)}% error · ${provider.requests} attempts`}</small></div>)}</div>
      {data.providers.length === 0 && <p className="muted">No enabled provider or recent upstream attempt.</p>}
      {data.providersTruncated && <p className="muted">Showing at most 200 providers, busiest first. Open Usage for provider breakdowns.</p>}
    </Panel>
    </>}
  </>;
}
