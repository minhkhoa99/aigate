import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useLiveUsage } from "../../shared/live-usage";
import { useLocale } from "../../shared/locale";
import { createFormatters } from "../../shared/i18n";
import { useOverview } from "./api";

const rate = (errors: number, requests: number) => requests ? errors / requests * 100 : 0;
const bars = (values: number[]) => { const max = Math.max(...values) || 1; return values.map((value) => value / max * 100); };
const TONES = { unknown: "muted", healthy: "healthy", degraded: "warning", down: "danger", success: "healthy", error: "danger", aborted: "warning" } as const;

export function Overview() {
  const { language, t } = useLocale();
  const summary = useOverview();
  const { live, connected, failure, reconnect } = useLiveUsage();
  const data = summary.data;
  const f = useMemo(() => createFormatters(language, data?.timezone), [language, data?.timezone]);
  const stopped = failure ? toProblem(failure.error, language) : null;
  const delta = (current: number, previous: number) => previous === 0
    ? t(current === 0 ? "overview.noChange" : "overview.noBaseline")
    : t("overview.delta", { value: f.signedPercent((current - previous) / previous) });
  const writer = connected ? live?.writer ?? data?.writer : data?.writer;
  const names = new Map(data?.providers.map((row) => [row.provider, row.name]) ?? []);
  return <>
    <PageHeading eyebrow={t("overview.eyebrow")} title={t("overview.title")} description={t("overview.description")}
      action={<Button onClick={() => { void summary.refetch(); }} disabled={summary.isFetching}>{t("common.refresh")}</Button>} />
    {summary.error ? <div className="state-block error"><code>{toProblem(summary.error, language).code}</code><strong>{t("overview.loadFailed")}</strong><p>{toProblem(summary.error, language).message}</p><Button onClick={() => { void summary.refetch(); }}>{t("common.retry")}</Button></div>
      : !data ? <StateBlock state="loading" /> : <>
    <div className="status-strip overview-status"><div className="row"><Pill tone="healthy">{t("overview.running")}</Pill><span className="target-label">{t("overview.endpoint")}</span><CopyField value={`${window.location.origin}/v1`} /></div>
      <div className="row muted"><span>{t("overview.uptime", { hours: f.number(Math.floor(data.uptimeSeconds / 3600)), minutes: f.number(Math.floor(data.uptimeSeconds % 3600 / 60)) })}</span><span>{t("overview.enabled", { count: f.number(data.enabledConnections) })}</span><span>{t("overview.inFlight", { count: connected && live ? f.number(live.active.reduce((sum, row) => sum + row.count, 0)) : "—" })}</span></div></div>
    <p className="muted">{t("overview.updated", { time: f.time(data.at), timezone: data.timezone })}</p>
    {writer && (writer.dropped > 0 || writer.failed > 0) && <Warning tone="danger">{t("overview.writer", { dropped: f.number(writer.dropped), failed: f.number(writer.failed) })}</Warning>}
    <div className="grid grid-4 section-gap">
      <Metric label={t("overview.requests")} value={f.number(data.current.requests)} delta={delta(data.current.requests, data.previous.requests)} bars={bars(data.buckets.map((row) => row.requests))} />
      <Metric label={t("overview.tokens")} value={f.compact(data.current.tokens)} delta={delta(data.current.tokens, data.previous.tokens)} bars={bars(data.buckets.map((row) => row.tokens))} tone="info" />
      <Metric label={t("overview.cost")} value={f.usd(data.current.cost)} delta={data.current.unpriced || data.previous.unpriced ? t("overview.partialCost", { current: f.number(data.current.unpriced), previous: f.number(data.previous.unpriced) }) : delta(data.current.cost, data.previous.cost)} bars={bars(data.buckets.map((row) => row.cost))} tone={data.current.unpriced ? "warning" : "healthy"} />
      <Metric label={t("overview.errorRate")} value={data.current.requests ? f.percent(data.current.errors / data.current.requests) : "—"}
        delta={data.current.requests && data.previous.requests ? t("overview.points", { value: f.decimal(rate(data.current.errors, data.current.requests) - rate(data.previous.errors, data.previous.requests)) }) : t("overview.notEnough")}
        bars={bars(data.buckets.map((row) => rate(row.errors, row.requests)))} tone={data.current.errors ? "warning" : "healthy"} />
    </div>
    {data.current.requests === 0 && <Panel title={t("overview.noTraffic")} className="section-gap"><p className="muted">{t("overview.firstRequest")}</p><div className="row"><Link to="/providers/connections" className="button">{t("overview.connections")}</Link><Link to="/integrations/cli-tools" className="button button-primary">{t("overview.configureCli")}</Link></div></Panel>}
    <div className="split section-gap">
      <Panel title={t("overview.liveRequests")} detail={t("overview.recent")} className="panel-flush" action={<div className="row"><Pill tone={connected ? "healthy" : stopped ? "danger" : "warning"}>{t(connected ? "overview.live" : stopped ? "overview.stopped" : "overview.reconnecting")}</Pill><Link to="/traffic/requests" className="button button-ghost">{t("overview.viewAll")}</Link></div>}>
        {stopped && <Warning tone="danger"><code>{stopped.code}</code> · {stopped.message} <Button onClick={reconnect}>{t("overview.reconnect")}</Button></Warning>}
        {!connected && live && <p className="muted">{t("overview.historical")}</p>}
        <Table columns={[t("overview.time"), t("overview.model"), t("overview.provider"), t("overview.ttft"), t("overview.tableTokens"), t("overview.status")]} empty={t("overview.emptyAttempts")} rows={(live?.recent ?? []).slice(0, 20).map((row) => [
          <Link to="/traffic/requests/detail" search={{ id: row.requestId }}><code>{f.time(row.at)}</code></Link>,
          <code>{row.model}</code>, names.get(row.provider) ?? row.provider, <span className="mono">{row.ttftMs === null ? "—" : t("overview.ms", { count: f.number(row.ttftMs) })}</span>,
          <span className="mono">{f.compact(row.inputTokens + row.outputTokens)}{row.estimated ? " ≈" : ""}</span>, <Pill tone={TONES[row.status]}>{row.errorCode ?? t(`overview.status.${row.status}`)}</Pill>,
        ])} />
      </Panel>
      <Panel title={t("overview.attention")} detail={t("overview.attentionHint")} action={<Pill tone={data.attention.length ? "warning" : "muted"}>{t("overview.alerts", { count: f.number(data.attention.length), suffix: data.attentionTruncated ? "+" : "" })}</Pill>}>
        <div className="attention-list">{data.attention.map((alert) => <Warning key={alert.id} tone={alert.tone}><strong>{names.get(alert.provider) ?? alert.provider} · {alert.name}</strong><small>{alert.message}</small>
          {alert.until !== null && <small>{t(alert.kind === "expiry" ? "overview.expiry" : "overview.lockEnds")}: {f.dateTime(alert.until)}</small>}
          <Link to={alert.kind === "quota" ? "/providers/quota" : "/providers/connections"}>{t(alert.kind === "quota" ? "overview.reviewQuota" : "overview.reviewConnection")}</Link></Warning>)}</div>
        {data.attention.length === 0 && <p className="muted">{t("overview.noAlert")}</p>}
        <p className="muted">{t("overview.quota", { checked: f.number(data.quotaChecked), enabled: f.number(data.enabledConnections) })} <Link to="/providers/quota">{t("overview.checkQuota")}</Link></p>
        {data.attentionTruncated && <p className="muted">{t("overview.alertLimit")}</p>}
      </Panel>
    </div>
    <Panel title={t("overview.health")} detail={t("overview.healthHint")} className="section-gap" action={<Link to="/providers/connections" className="button button-ghost">{t("overview.connectionsLink")}</Link>}>
      <div className="provider-grid">{data.providers.map((provider) => <div className="provider-tile" key={provider.provider}><div><strong>{provider.name}</strong><Dot tone={TONES[provider.health]} /></div>
        <small>{t(`overview.health.${provider.health}`)} · {provider.errorRate === null ? t("overview.noRecent") : t("overview.attempts", { rate: f.percent(provider.errorRate), count: f.number(provider.requests) })}</small></div>)}</div>
      {data.providers.length === 0 && <p className="muted">{t("overview.noProvider")}</p>}
      {data.providersTruncated && <p className="muted">{t("overview.providerLimit")}</p>}
    </Panel>
    </>}
  </>;
}
