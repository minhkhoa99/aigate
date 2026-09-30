import { useRef, useState } from "react";
import { Button, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { CostChart, Legend, TokenChart, type Series } from "./charts";
import { periodParams, useLiveUsage, useUsageChart, useUsageSummary, type PeriodQuery } from "./api";
import { PricingModal } from "./pricing-modal";
import { assignSlots, chartSeries, errorRate, formatCost, formatTokens, OTHER } from "./usage-format";

// docs/contracts/usage.md "UI": the period lives in the URL (?period=, and from/to for custom).

const PERIODS: [string, string][] = [["today", "Today"], ["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["custom", "Custom range"]];

function readPeriod(): PeriodQuery {
  const params = new URLSearchParams(window.location.search);
  const period = params.get("period") ?? "7d";
  if (!PERIODS.some(([id]) => id === period)) return { period: "7d" };
  return period === "custom" ? { period, from: params.get("from") ?? "", to: params.get("to") ?? "" } : { period };
}

const STATUS_TONE = { success: "healthy", error: "danger", aborted: "warning" } as const;

export function Usage() {
  const [query, setQuery] = useState<PeriodQuery>(readPeriod);
  const [custom, setCustom] = useState({ from: query.from ?? "", to: query.to ?? "" });
  const [pricing, setPricing] = useState(false);
  const slots = useRef(new Map<string, number>());
  const ready = query.period !== "custom" || Boolean(query.from && query.to);
  const summary = useUsageSummary(query, ready);
  const chart = useUsageChart(query, ready);
  const { live, connected, stopped } = useLiveUsage();

  const apply = (next: PeriodQuery) => {
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}?${periodParams(next)}`);
  };

  const names = new Map((summary.data?.byProvider ?? []).map((row) => [row.provider, row.providerName]));
  const providerTotals: Record<string, number> = {};
  for (const bucket of chart.data?.buckets ?? []) for (const [provider, tokens] of Object.entries(bucket.tokens)) providerTotals[provider] = (providerTotals[provider] ?? 0) + tokens;
  const { named, other } = chartSeries(providerTotals);
  slots.current = assignSlots(slots.current, named);
  const series: Series[] = [...named.map((key) => ({ key, label: names.get(key) ?? key, slot: slots.current.get(key) ?? 0 })), ...(other ? [{ key: OTHER, label: "Other", slot: null }] : [])];
  const legendTotals = { ...providerTotals, [OTHER]: Object.entries(providerTotals).filter(([provider]) => !named.includes(provider)).reduce((sum, [, tokens]) => sum + tokens, 0) };

  const totals = summary.data?.totals;
  const writer = live?.writer ?? summary.data?.writer;
  const failure = summary.error ?? chart.error;
  const zone = summary.data?.timezone ?? chart.data?.timezone;

  return <>
    <PageHeading eyebrow="Traffic / Usage" title="Usage analytics" description={`Requests, tokens and cost of every upstream call${zone ? `, by day in ${zone}` : ""}.`}
      action={<div className="row usage-actions">
        <select className="input" aria-label="Period" value={query.period} onChange={(event) => apply(event.target.value === "custom" ? { period: "custom", ...custom } : { period: event.target.value })}>
          {PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        {query.period === "custom" && <>
          <input className="input" type="date" aria-label="From" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} />
          <input className="input" type="date" aria-label="To" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} />
          <Button onClick={() => apply({ period: "custom", ...custom })} disabled={!custom.from || !custom.to}>Apply</Button>
        </>}
        <a className="button" href={`/api/usage/export.csv?${periodParams(query)}`} download>Export CSV</a>
        <Button onClick={() => setPricing(true)}>Pricing</Button>
      </div>} />

    {writer && (writer.dropped > 0 || writer.failed > 0) && <Warning tone="danger">
      Usage recording lost data since the server started: {writer.dropped} event{writer.dropped === 1 ? "" : "s"} dropped (the queue was full) and {writer.failed} batch{writer.failed === 1 ? "" : "es"} failed to write. Figures below are lower than the real traffic; check the server log.
    </Warning>}

    {!ready ? <StateBlock state="empty" action={<p>Pick a start and end date, then Apply.</p>} />
      : failure ? <div className="state-block error"><code>{toProblem(failure).code}</code><strong>Could not load usage</strong><p>{toProblem(failure).message}</p><Button onClick={() => { void summary.refetch(); void chart.refetch(); }}>Retry</Button></div>
      : !totals || !chart.data ? <StateBlock state="loading" />
      : <>
        <div className="grid grid-4">
          <Metric label="Requests" value={totals.requests.toLocaleString("en-US")} delta={`${errorRate(totals.errors, totals.requests)} failed or aborted`} tone={totals.errors > 0 ? "warning" : "healthy"} />
          <Metric label="Input tokens" value={formatTokens(totals.inputTokens)} delta={`+${formatTokens(totals.cacheReadTokens)} cache read`} tone="info" />
          <Metric label="Output tokens" value={formatTokens(totals.outputTokens)} delta={totals.reasoningTokens > 0 ? `${formatTokens(totals.reasoningTokens)} reasoning` : undefined} tone="info" />
          <Metric label="Estimated cost" value={formatCost(totals.cost)} delta={totals.unpriced > 0 ? `${totals.unpriced} unpriced call${totals.unpriced === 1 ? "" : "s"} not included` : "every call priced"} tone={totals.unpriced > 0 ? "warning" : "healthy"} />
        </div>
        {totals.requests === 0 ? <Panel title="No usage yet" className="section-gap"><p className="muted">No upstream call was recorded in this period. Send a request through /v1 and it appears here within a few seconds.</p></Panel> : <>
          <div className="grid usage-charts section-gap">
            <Panel title="Tokens by provider" detail={`Input, output and cache tokens per ${chart.data.bucket === "hour" ? "hour" : "day"}. Hover a bar for its split.`}>
              <TokenChart chart={chart.data} series={series} />
              <Legend series={series} totals={legendTotals} />
            </Panel>
            <Panel title="Cost" detail="Estimated from the price in effect when each call was recorded."><CostChart chart={chart.data} /></Panel>
          </div>
          <Panel title="Provider × model" detail="The table view of the charts above; at most 200 rows, busiest first." className="section-gap panel-flush">
            <Table columns={["Provider", "Model", "Requests", "Input", "Output", "Cache read", "Cost", "Error %"]}
              rows={summary.data?.byModel.map((row) => [row.providerName, <code>{row.model}</code>, row.requests.toLocaleString("en-US"), formatTokens(row.inputTokens), formatTokens(row.outputTokens),
                formatTokens(row.cacheReadTokens), row.unpriced === row.requests ? <span className="muted">unpriced</span> : formatCost(row.cost), errorRate(row.errors, row.requests)]) ?? []} />
          </Panel>
        </>}
      </>}

    <div className="grid grid-2 section-gap">
      <Panel title="Running now" action={<Pill tone={connected ? "healthy" : stopped ? "danger" : "warning"}>{connected ? "Live" : stopped ? "Stopped" : "Reconnecting"}</Pill>}>
        {stopped ? <p className="text-danger">{stopped.message}</p> : live && live.active.length > 0 ? <div className="stack">{live.active.map((entry) => <div className="list-row" key={`${entry.provider}/${entry.model}/${entry.connectionId ?? ""}`}>
          <div><strong>{names.get(entry.provider) ?? entry.provider} · {entry.model}</strong><small>{entry.connectionId ? `connection ${entry.connectionId.slice(0, 8)}` : "no saved connection"}</small></div><Pill tone="info">{entry.count} active</Pill></div>)}</div>
          : <p className="muted">No call in flight.</p>}
      </Panel>
      <Panel title="Recent calls" detail="The last 20 upstream calls, newest first." className="panel-flush">
        <Table columns={["Time", "Model", "Status", "Tokens", "Latency", "Cost"]} empty="No call since the server started."
          rows={(live?.recent ?? []).map((event) => [new Date(event.at).toLocaleTimeString(), <span><small className="muted">{names.get(event.provider) ?? event.provider}</small> <code>{event.model}</code></span>,
            <Pill tone={STATUS_TONE[event.status]}>{event.status}{event.errorCode ? ` · ${event.errorCode}` : ""}</Pill>,
            `${formatTokens(event.inputTokens)} → ${formatTokens(event.outputTokens)}${event.estimated ? " (est.)" : ""}`,
            `${event.latencyMs} ms${event.ttftMs !== null ? ` · TTFT ${event.ttftMs} ms` : ""}`, event.cost === null ? <span className="muted">unpriced</span> : formatCost(event.cost)])} />
      </Panel>
    </div>
    {pricing && <PricingModal onClose={() => setPricing(false)} />}
  </>;
}
