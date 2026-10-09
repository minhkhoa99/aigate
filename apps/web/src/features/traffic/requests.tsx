import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { createFormatters } from "../../shared/i18n";
import { MAX_REQUEST_ROWS, useRequestDetail, useRequestFilters, useRequests, type RequestFilters, type UsageStatus } from "./api";
import { formatCost, formatTokens } from "./usage-format";

// docs/contracts/requests-ui-i18n.md: keep SP24b URL filters, cursor pages and metadata literal.
const TONE: Record<UsageStatus, "healthy" | "danger" | "warning"> = { success: "healthy", error: "danger", aborted: "warning" };
const FILTER_KEYS = ["status", "provider", "model", "endpoint", "fallback"] as const;

function readFilters(): RequestFilters {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(FILTER_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key) ?? ""]] : [])));
}

export function Requests() {
  const { language, t } = useLocale();
  const f = createFormatters(language);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const tokens = (value: number) => formatTokens(value, locale);
  const money = (value: number) => formatCost(value, locale);
  const ms = (value: number | null) => value === null ? "—" : `${f.number(value)} ms`;
  const statusPill = (status: UsageStatus, code: string | null) =>
    <Pill tone={TONE[status]}>{t(`requests.status.${status}`)}{code ? ` · ${code}` : ""}</Pill>;
  const [filters, setFilters] = useState<RequestFilters>(readFilters);
  const requests = useRequests(filters);
  const options = useRequestFilters();
  const rows = requests.data?.pages.flatMap((page) => page.items) ?? [];
  const listProblem = requests.isError ? toProblem(requests.error, language) : null;
  const optionsProblem = options.isError ? toProblem(options.error, language) : null;

  const set = (key: keyof RequestFilters, value: string) => {
    const next = { ...filters, [key]: value || undefined };
    if (key === "provider") next.model = undefined;
    setFilters(next);
    const query = new URLSearchParams(Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };
  const models = (options.data?.models ?? []).filter((row) => !filters.provider || row.provider === filters.provider);
  const capped = rows.length >= MAX_REQUEST_ROWS && requests.data?.pages.at(-1)?.nextCursor;
  const rowCost = (cost: number | null, unpriced: number) => cost === null
    ? <span className="muted">{unpriced > 0 ? t("requests.unpriced") : "—"}</span> : money(cost);

  return <>
    <PageHeading eyebrow={t("requests.eyebrow")} title={t("requests.title")} description={t("requests.description")} />
    <Panel title={t("requests.history")} detail={t("requests.historyHint")} className="panel-flush">
      <div className="table-toolbar requests-filters">
        <select className="input" aria-label={t("requests.statusLabel")} value={filters.status ?? ""} onChange={(event) => set("status", event.target.value)}>
          <option value="">{t("requests.allStatuses")}</option><option value="error">{t("requests.errorsAborted")}</option>
        </select>
        <select className="input" aria-label={t("requests.provider")} value={filters.provider ?? ""} onChange={(event) => set("provider", event.target.value)}>
          <option value="">{t("requests.allProviders")}</option>{(options.data?.providers ?? []).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </select>
        <select className="input" aria-label={t("requests.model")} value={filters.model ?? ""} onChange={(event) => set("model", event.target.value)}>
          <option value="">{t("requests.allModels")}</option>{models.map((row) => <option key={`${row.provider}/${row.model}`} value={row.model}>{row.model}</option>)}
        </select>
        <select className="input" aria-label={t("requests.endpoint")} value={filters.endpoint ?? ""} onChange={(event) => set("endpoint", event.target.value)}>
          <option value="">{t("requests.allEndpoints")}</option>{(options.data?.endpoints ?? []).map((endpoint) => <option key={endpoint} value={endpoint}>{endpoint}</option>)}
        </select>
        <label className="row requests-check"><input type="checkbox" checked={filters.fallback === "1"} onChange={(event) => set("fallback", event.target.checked ? "1" : "")} /> {t("requests.withFallback")}</label>
      </div>
      {optionsProblem && <Warning tone="danger"><code>{optionsProblem.code}</code> · {optionsProblem.message} <Button onClick={() => void options.refetch()}>{t("common.retry")}</Button></Warning>}
      {!requests.data && listProblem ? <div className="state-block error"><code>{listProblem.code}</code><strong>{t("requests.loadFailed")}</strong><p>{listProblem.message}</p><Button onClick={() => void requests.refetch()}>{t("common.retry")}</Button></div>
        : requests.isPending ? <StateBlock state="loading" />
        : <>
          {listProblem && <Warning tone="danger"><code>{listProblem.code}</code> · {listProblem.message} <Button onClick={() => void (requests.isFetchNextPageError ? requests.fetchNextPage() : requests.refetch())}>{t("common.retry")}</Button></Warning>}
          <Table columns={[t("requests.time"), t("requests.model"), t("requests.provider"), t("requests.account"), t("requests.statusLabel"), t("requests.attempts"), "TTFT", t("requests.latency"), t("requests.tokens"), t("requests.cost")]}
            empty={Object.keys(filters).length ? t("requests.emptyFiltered") : t("requests.empty")}
            rows={rows.map((row) => [
              <a className="table-link mono" href={`/traffic/requests/detail?id=${encodeURIComponent(row.id)}`}>{f.dateTime(row.at)}</a>,
              <code>{row.requestedModel ?? "—"}</code>, row.providerName ?? "—", row.connectionName ?? <span className="muted">{t("requests.none")}</span>, statusPill(row.status, row.errorCode),
              row.attempts > 1 ? <Pill tone="warning">{f.number(row.attempts)}</Pill> : f.number(row.attempts), ms(row.ttftMs), ms(row.latencyMs),
              `${tokens(row.inputTokens)} → ${tokens(row.outputTokens)}`, rowCost(row.cost, row.unpriced),
            ])} />
        </>}
      {(requests.hasNextPage || capped) && !requests.isFetchNextPageError && <div className="requests-more">
        {capped ? <span className="muted">{t("requests.capped", { count: f.number(MAX_REQUEST_ROWS) })}</span>
          : <Button onClick={() => void requests.fetchNextPage()} disabled={requests.isFetchingNextPage}>{t(requests.isFetchingNextPage ? "requests.loadingMore" : "requests.loadMore")}</Button>}
      </div>}
    </Panel>
  </>;
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const { language, t } = useLocale();
  const f = createFormatters(language);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const tokens = (value: number) => formatTokens(value, locale);
  const money = (value: number) => formatCost(value, locale);
  const ms = (value: number | null) => value === null ? "—" : `${f.number(value)} ms`;
  const detail = useRequestDetail(requestId);

  if (!requestId) {
    return <><PageHeading eyebrow={t("requests.eyebrow")} title={t("requests.detailTitle")} description={t("requests.noSelection")} />
      <div className="state-block"><strong>{t("requests.noId")}</strong><p>{t("requests.openFromList")}</p><Link className="button" to="/traffic/requests">{t("requests.back")}</Link></div></>;
  }
  if (detail.isError) {
    const problem = toProblem(detail.error, language);
    return <><PageHeading eyebrow={t("requests.eyebrow")} title={t("requests.detailTitle")} description={requestId} />
      <div className="state-block error"><code>{problem.code}</code><strong>{t("requests.detailFailed")}</strong><p>{problem.message}</p><Button onClick={() => void detail.refetch()}>{t("common.retry")}</Button><Link className="button" to="/traffic/requests">{t("requests.back")}</Link></div></>;
  }
  if (!detail.data) return <><PageHeading eyebrow={t("requests.eyebrow")} title={t("requests.detailTitle")} description={requestId} /><StateBlock state="loading" /></>;
  const { request, attempts } = detail.data;
  const totalTokens = request.inputTokens + request.outputTokens + request.cacheReadTokens + request.cacheWriteTokens;
  return <>
    <PageHeading eyebrow={t("requests.detailEyebrow", { id: request.id.slice(0, 8) })} title={t("requests.detailTitle")} description={`${request.endpoint} · ${f.dateTime(request.at)}`}
      action={<Pill tone={TONE[request.status]}>{request.httpStatus} {t(`requests.status.${request.status}`)}</Pill>} />
    <div className="grid grid-4">
      <Metric label={t("requests.totalLatency")} value={ms(request.latencyMs)} />
      <Metric label={t("requests.firstToken")} value={ms(request.ttftMs)} delta={t(request.stream ? "requests.streamed" : "requests.notStreamed")} tone="info" />
      <Metric label={t("requests.tokens")} value={tokens(totalTokens)} delta={t("requests.tokenSplit", { input: tokens(request.inputTokens), output: tokens(request.outputTokens) })} tone="info" />
      <Metric label={t("requests.estimatedCost")} value={request.cost === null ? "—" : money(request.cost)} delta={request.unpriced > 0 ? t("requests.unpricedAttempts", { count: f.number(request.unpriced) }) : undefined} tone="warning" />
    </div>
    <div className="split section-gap">
      <Panel title={t("requests.timeline")} detail={attempts.length === 0 ? t("requests.noUpstream") : t("requests.upstreamCalls", { count: f.number(attempts.length) })}>
        <div className="timeline">
          <div><Dot tone="info" /><strong>{t("requests.inbound", { endpoint: request.endpoint })}</strong><small>{f.time(request.at)} · {t("requests.modelLower")} <code>{request.requestedModel ?? "—"}</code>{request.keyName ? ` · ${t("requests.key", { name: request.keyName })}` : ""}</small></div>
          {attempts.map((attempt, index) => <div key={attempt.id}>
            <Dot tone={TONE[attempt.status]} />
            <strong>{t("requests.attempt", { count: f.number(index + 1) })} · {attempt.providerName ?? attempt.provider} / {attempt.connectionName ?? t("requests.noConnection")}</strong>
            <small><code>{attempt.model}</code> · {t(`requests.status.${attempt.status}`)}{attempt.errorCode ? ` · ${attempt.errorCode}` : ""} · {ms(attempt.latencyMs)}{attempt.ttftMs !== null ? ` · TTFT ${ms(attempt.ttftMs)}` : ""} · {tokens(attempt.inputTokens)} → {tokens(attempt.outputTokens)}{attempt.estimated ? ` ${t("requests.estimated")}` : ""} · {attempt.cost === null ? t("requests.unpriced") : money(attempt.cost)}</small>
          </div>)}
          <div><Dot tone={TONE[request.status]} /><strong>{t("requests.answered", { status: request.httpStatus })}</strong><small>{t(`requests.status.${request.status}`)}{request.errorCode ? ` · ${request.errorCode}` : ""}</small></div>
        </div>
      </Panel>
      <Panel title={t("requests.metadata")}>
        <div className="stack">
          <CopyField label={t("requests.requestIdLabel")} value={request.id} />
          <div className="list-row"><div><strong>{t("requests.finalProvider")}</strong><small>{request.providerName ?? "—"} · {request.connectionName ?? t("requests.noConnection")}</small></div></div>
          <div className="list-row"><div><strong>{t("requests.finalModel")}</strong><small><code>{request.finalModel ?? "—"}</code></small></div></div>
          <div className="list-row"><div><strong>{t("requests.apiKey")}</strong><small>{request.keyName ?? t("requests.keyless")}</small></div></div>
        </div>
      </Panel>
    </div>
    <Warning>{t("requests.privacy")}</Warning>
  </>;
}
