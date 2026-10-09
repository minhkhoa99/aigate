import { useRef, useState } from "react";
import { Button, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { CostChart, Legend, TokenChart, type Series } from "./charts";
import { useLiveUsage } from "../../shared/live-usage";
import { periodParams, useUsageChart, useUsageSummary, type PeriodQuery } from "./api";
import { PricingModal } from "./pricing-modal";
import { assignSlots, chartSeries, errorRate, formatCost, formatTokens, OTHER } from "./usage-format";

// docs/contracts/usage.md "UI": the period lives in the URL (?period=, and from/to for custom).

const PERIODS = ["today", "24h", "7d", "30d", "90d", "custom"] as const;

function readPeriod(): PeriodQuery {
  const params = new URLSearchParams(window.location.search);
  const period = params.get("period") ?? "7d";
  if (!PERIODS.some((id) => id === period)) return { period: "7d" };
  return period === "custom" ? { period, from: params.get("from") ?? "", to: params.get("to") ?? "" } : { period };
}

const STATUS_TONE = { success: "healthy", error: "danger", aborted: "warning" } as const;

export function Usage() {
  const { language, t } = useLocale();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const number = new Intl.NumberFormat(locale).format;
  const tokens = (value: number) => formatTokens(value, locale);
  const cost = (value: number) => formatCost(value, locale);
  const percent = (errors: number, requests: number) => errorRate(errors, requests, locale);
  const [query, setQuery] = useState<PeriodQuery>(readPeriod);
  const [custom, setCustom] = useState({ from: query.from ?? "", to: query.to ?? "" });
  const [pricing, setPricing] = useState(false);
  const slots = useRef(new Map<string, number>());
  const ready = query.period !== "custom" || Boolean(query.from && query.to);
  const summary = useUsageSummary(query, ready);
  const chart = useUsageChart(query, ready);
  const { live, connected, failure: streamFailure, stopped, reconnect } = useLiveUsage();

  const apply = (next: PeriodQuery) => {
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}?${periodParams(next)}`);
  };

  const names = new Map((summary.data?.byProvider ?? []).map((row) => [row.provider, row.providerName]));
  const providerTotals: Record<string, number> = {};
  for (const bucket of chart.data?.buckets ?? []) for (const [provider, tokens] of Object.entries(bucket.tokens)) providerTotals[provider] = (providerTotals[provider] ?? 0) + tokens;
  const { named, other } = chartSeries(providerTotals);
  slots.current = assignSlots(slots.current, named);
  const series: Series[] = [...named.map((key) => ({ key, label: names.get(key) ?? key, slot: slots.current.get(key) ?? 0 })), ...(other ? [{ key: OTHER, label: t("usage.other"), slot: null }] : [])];
  const legendTotals = { ...providerTotals, [OTHER]: Object.entries(providerTotals).filter(([provider]) => !named.includes(provider)).reduce((sum, [, tokens]) => sum + tokens, 0) };

  const totals = summary.data?.totals;
  const writer = connected ? live?.writer ?? summary.data?.writer : summary.data?.writer;
  const failure = summary.error ?? chart.error;
  const problem = failure ? toProblem(failure, language) : null;
  const zone = summary.data?.timezone ?? chart.data?.timezone;

  return <>
    <PageHeading eyebrow={t("usage.eyebrow")} title={t("usage.title")} description={zone ? t("usage.descriptionZone", { zone }) : t("usage.description")}
      action={<div className="row usage-actions">
        <select className="input" aria-label={t("usage.period")} value={query.period} onChange={(event) => apply(event.target.value === "custom" ? { period: "custom", ...custom } : { period: event.target.value })}>
          {PERIODS.map((id) => <option key={id} value={id}>{t(`usage.period.${id}`)}</option>)}
        </select>
        {query.period === "custom" && <>
          <input className="input" type="date" aria-label={t("usage.from")} value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} />
          <input className="input" type="date" aria-label={t("usage.to")} value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} />
          <Button onClick={() => apply({ period: "custom", ...custom })} disabled={!custom.from || !custom.to}>{t("usage.apply")}</Button>
        </>}
        {ready ? <a className="button" href={`/api/usage/export.csv?${periodParams(query)}`} download>{t("usage.export")}</a> : <Button disabled>{t("usage.export")}</Button>}
        <Button onClick={() => setPricing(true)}>{t("usage.pricing")}</Button>
      </div>} />

    {writer && (writer.dropped > 0 || writer.failed > 0) && <Warning tone="danger">
      {t("usage.writerLoss", { dropped: number(writer.dropped), failed: number(writer.failed) })}
    </Warning>}

    {!ready ? <StateBlock state="empty" action={<p>{t("usage.pickDates")}</p>} />
      : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("usage.loadFailed")}</strong><p>{problem.message}</p><Button onClick={() => { void summary.refetch(); void chart.refetch(); }}>{t("common.retry")}</Button></div>
      : !totals || !chart.data ? <StateBlock state="loading" />
      : <>
        <div className="grid grid-4">
          <Metric label={t("usage.requests")} value={number(totals.requests)} delta={t("usage.failedRate", { percent: percent(totals.errors, totals.requests) })} tone={totals.errors > 0 ? "warning" : "healthy"} />
          <Metric label={t("usage.inputTokens")} value={tokens(totals.inputTokens)} delta={t("usage.cacheReadDelta", { count: tokens(totals.cacheReadTokens) })} tone="info" />
          <Metric label={t("usage.outputTokens")} value={tokens(totals.outputTokens)} delta={totals.reasoningTokens > 0 ? t("usage.reasoningDelta", { count: tokens(totals.reasoningTokens) }) : undefined} tone="info" />
          <Metric label={t("usage.estimatedCost")} value={cost(totals.cost)} delta={totals.unpriced > 0 ? t("usage.unpricedDelta", { count: number(totals.unpriced) }) : t("usage.allPriced")} tone={totals.unpriced > 0 ? "warning" : "healthy"} />
        </div>
        {totals.requests === 0 ? <Panel title={t("usage.emptyTitle")} className="section-gap"><p className="muted">{t("usage.emptyHint")}</p></Panel> : <>
          <div className="grid usage-charts section-gap">
            <Panel title={t("usage.tokensByProvider")} detail={t(chart.data.bucket === "hour" ? "usage.chartHourHint" : "usage.chartDayHint")}>
              <TokenChart chart={chart.data} series={series} />
              <Legend series={series} totals={legendTotals} />
            </Panel>
            <Panel title={t("usage.cost")} detail={t("usage.costHint")}><CostChart chart={chart.data} /></Panel>
          </div>
          <Panel title={t("usage.providerModel")} detail={t("usage.tableHint")} className="section-gap panel-flush">
            <Table columns={[t("usage.provider"), t("usage.model"), t("usage.requests"), t("usage.input"), t("usage.output"), t("usage.cacheRead"), t("usage.cost"), t("usage.errorPercent")]}
              rows={summary.data?.byModel.map((row) => [row.providerName, <code>{row.model}</code>, number(row.requests), tokens(row.inputTokens), tokens(row.outputTokens),
                tokens(row.cacheReadTokens), row.unpriced === row.requests ? <span className="muted">{t("usage.unpriced")}</span> : cost(row.cost), percent(row.errors, row.requests)]) ?? []} />
          </Panel>
        </>}
      </>}

    <div className="grid grid-2 section-gap">
      <Panel title={t("usage.runningNow")} action={<Pill tone={connected ? "healthy" : stopped ? "danger" : "warning"}>{connected ? t("usage.live") : stopped ? t("usage.stopped") : t("usage.reconnecting")}</Pill>}>
        {stopped ? <><p className="text-danger"><code>{stopped.code}</code> · {streamFailure ? toProblem(streamFailure.error, language).message : stopped.message}</p><Button onClick={reconnect}>{t("usage.reconnect")}</Button></> : !connected ? <p className="muted">{t("usage.liveUnknown")}</p> : live && live.active.length > 0 ? <div className="stack">{live.active.map((entry) => <div className="list-row" key={`${entry.provider}/${entry.model}/${entry.connectionId ?? ""}`}>
          <div><strong>{names.get(entry.provider) ?? entry.provider} · {entry.model}</strong><small>{entry.connectionId ? t("usage.connection", { id: entry.connectionId.slice(0, 8) }) : t("usage.noConnection")}</small></div><Pill tone="info">{t("usage.active", { count: number(entry.count) })}</Pill></div>)}</div>
          : <p className="muted">{t("usage.noInflight")}</p>}
      </Panel>
      <Panel title={t("usage.recentCalls")} detail={t("usage.recentHint")} className="panel-flush">
        {!connected && live && <p className="muted">{t("usage.lastReceived")}</p>}
        <Table columns={[t("usage.time"), t("usage.model"), t("usage.status"), t("usage.tokens"), t("usage.latency"), t("usage.cost")]} empty={t("usage.noRecent")}
          rows={(live?.recent ?? []).map((event) => [new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(event.at), <span><small className="muted">{names.get(event.provider) ?? event.provider}</small> <code>{event.model}</code></span>,
            <Pill tone={STATUS_TONE[event.status]}>{t(`usage.status.${event.status}`)}{event.errorCode ? ` · ${event.errorCode}` : ""}</Pill>,
            `${tokens(event.inputTokens)} → ${tokens(event.outputTokens)}${event.estimated ? ` ${t("usage.estimated")}` : ""}`,
            `${number(event.latencyMs)} ms${event.ttftMs !== null ? ` · TTFT ${number(event.ttftMs)} ms` : ""}`, event.cost === null ? <span className="muted">{t("usage.unpriced")}</span> : cost(event.cost)])} />
      </Panel>
    </div>
    {pricing && <PricingModal onClose={() => setPricing(false)} />}
  </>;
}
