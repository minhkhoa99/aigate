import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Metric, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { MAX_REQUEST_ROWS, useRequestDetail, useRequestFilters, useRequests, type RequestFilters, type UsageStatus } from "./api";
import { formatCost, formatTokens } from "./usage-format";

// docs/contracts/usage.md "Requests": filters in the URL, cursor pages, and a timeline of each request's attempts.

const TONE: Record<UsageStatus, "healthy" | "danger" | "warning"> = { success: "healthy", error: "danger", aborted: "warning" };
const FILTER_KEYS = ["status", "provider", "model", "endpoint", "fallback"] as const;

function readFilters(): RequestFilters {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(FILTER_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key) ?? ""]] : [])));
}

const cost = (row: { cost: number | null; unpriced: number }) => (row.cost === null ? <span className="muted">{row.unpriced > 0 ? "unpriced" : "—"}</span> : formatCost(row.cost));
const ms = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("en-US")} ms`);
const statusPill = (status: UsageStatus, code: string | null) => <Pill tone={TONE[status]}>{status}{code ? ` · ${code}` : ""}</Pill>;

export function Requests() {
  const [filters, setFilters] = useState<RequestFilters>(readFilters);
  const requests = useRequests(filters);
  const options = useRequestFilters();
  const rows = requests.data?.pages.flatMap((page) => page.items) ?? [];
  const set = (key: keyof RequestFilters, value: string) => {
    const next = { ...filters, [key]: value || undefined };
    if (key === "provider") next.model = undefined;
    setFilters(next);
    const query = new URLSearchParams(Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };
  const models = (options.data?.models ?? []).filter((row) => !filters.provider || row.provider === filters.provider);
  const capped = rows.length >= MAX_REQUEST_ROWS && requests.data?.pages.at(-1)?.nextCursor;

  return <>
    <PageHeading eyebrow="Traffic / Requests" title="Requests" description="Every client request with its attempts across providers and accounts. Request and response bodies are never stored." />
    <Panel title="Request history" detail="Newest first. Click a request for its attempt timeline." className="panel-flush">
      <div className="table-toolbar requests-filters">
        <select className="input" aria-label="Status" value={filters.status ?? ""} onChange={(event) => set("status", event.target.value)}>
          <option value="">All statuses</option><option value="error">Errors and aborted</option>
        </select>
        <select className="input" aria-label="Provider" value={filters.provider ?? ""} onChange={(event) => set("provider", event.target.value)}>
          <option value="">All providers</option>{(options.data?.providers ?? []).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </select>
        <select className="input" aria-label="Model" value={filters.model ?? ""} onChange={(event) => set("model", event.target.value)}>
          <option value="">All models</option>{models.map((row) => <option key={`${row.provider}/${row.model}`} value={row.model}>{row.model}</option>)}
        </select>
        <select className="input" aria-label="Endpoint" value={filters.endpoint ?? ""} onChange={(event) => set("endpoint", event.target.value)}>
          <option value="">All endpoints</option>{(options.data?.endpoints ?? []).map((endpoint) => <option key={endpoint} value={endpoint}>{endpoint}</option>)}
        </select>
        <label className="row requests-check"><input type="checkbox" checked={filters.fallback === "1"} onChange={(event) => set("fallback", event.target.checked ? "1" : "")} /> With fallback</label>
      </div>
      {requests.isError ? <div className="state-block error"><code>{toProblem(requests.error).code}</code><strong>Could not load requests</strong><p>{toProblem(requests.error).message}</p><Button onClick={() => void requests.refetch()}>Retry</Button></div>
        : requests.isPending ? <StateBlock state="loading" />
        : <Table columns={["Time", "Model", "Provider", "Account", "Status", "Attempts", "TTFT", "Latency", "Tokens", "Cost"]}
          empty={Object.keys(filters).length ? "No request matches these filters." : "No request recorded yet. Send one through /v1 and it appears here within a few seconds."}
          rows={rows.map((row) => [
            <a className="table-link mono" href={`/traffic/requests/detail?id=${encodeURIComponent(row.id)}`}>{new Date(row.at).toLocaleString()}</a>,
            <code>{row.requestedModel ?? "—"}</code>, row.providerName ?? "—", row.connectionName ?? <span className="muted">none</span>, statusPill(row.status, row.errorCode),
            row.attempts > 1 ? <Pill tone="warning">{row.attempts}</Pill> : String(row.attempts), ms(row.ttftMs), ms(row.latencyMs),
            `${formatTokens(row.inputTokens)} → ${formatTokens(row.outputTokens)}`, cost(row),
          ])} />}
      {(requests.hasNextPage || capped) && <div className="requests-more">
        {capped ? <span className="muted">Showing the newest {MAX_REQUEST_ROWS}. Narrow the filters to see older requests.</span>
          : <Button onClick={() => void requests.fetchNextPage()} disabled={requests.isFetchingNextPage}>{requests.isFetchingNextPage ? "Loading…" : "Load more"}</Button>}
      </div>}
    </Panel>
  </>;
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const detail = useRequestDetail(requestId);
  if (!requestId) {
    return <><PageHeading eyebrow="Traffic / Requests" title="Request detail" description="No request selected." />
      <div className="state-block"><strong>No request id in the address</strong><p>Open a request from the Requests list.</p><Link className="button" to="/traffic/requests">Back to requests</Link></div></>;
  }
  if (detail.isError) {
    const problem = toProblem(detail.error);
    return <><PageHeading eyebrow="Traffic / Requests" title="Request detail" description={requestId} />
      <div className="state-block error"><code>{problem.code}</code><strong>Could not load this request</strong><p>{problem.message}</p><Link className="button" to="/traffic/requests">Back to requests</Link></div></>;
  }
  if (!detail.data) return <><PageHeading eyebrow="Traffic / Requests" title="Request detail" description={requestId} /><StateBlock state="loading" /></>;
  const { request, attempts } = detail.data;
  const tokens = request.inputTokens + request.outputTokens + request.cacheReadTokens + request.cacheWriteTokens;
  return <>
    <PageHeading eyebrow={`Traffic / Requests / ${request.id.slice(0, 8)}`} title="Request detail" description={`${request.endpoint} · ${new Date(request.at).toLocaleString()}`}
      action={<Pill tone={TONE[request.status]}>{request.httpStatus} {request.status}</Pill>} />
    <div className="grid grid-4">
      <Metric label="Total latency" value={ms(request.latencyMs)} />
      <Metric label="Time to first token" value={ms(request.ttftMs)} delta={request.stream ? "streamed" : "not streamed"} tone="info" />
      <Metric label="Tokens" value={formatTokens(tokens)} delta={`${formatTokens(request.inputTokens)} in · ${formatTokens(request.outputTokens)} out`} tone="info" />
      <Metric label="Estimated cost" value={request.cost === null ? "—" : formatCost(request.cost)} delta={request.unpriced > 0 ? `${request.unpriced} unpriced attempt${request.unpriced === 1 ? "" : "s"}` : undefined} tone="warning" />
    </div>
    <div className="split section-gap">
      <Panel title="Attempt timeline" detail={attempts.length === 0 ? "No upstream call was made: AIGate answered the request itself." : `${attempts.length} upstream call${attempts.length === 1 ? "" : "s"}, in order.`}>
        <div className="timeline">
          <div><Dot tone="info" /><strong>Inbound {request.endpoint}</strong><small>{new Date(request.at).toLocaleTimeString()} · model <code>{request.requestedModel ?? "—"}</code>{request.keyName ? ` · key ${request.keyName}` : ""}</small></div>
          {attempts.map((attempt, index) => <div key={attempt.id}>
            <Dot tone={TONE[attempt.status]} />
            <strong>Attempt {index + 1} · {attempt.providerName ?? attempt.provider} / {attempt.connectionName ?? "no saved connection"}</strong>
            <small><code>{attempt.model}</code> · {attempt.status}{attempt.errorCode ? ` · ${attempt.errorCode}` : ""} · {ms(attempt.latencyMs)}{attempt.ttftMs !== null ? ` · TTFT ${ms(attempt.ttftMs)}` : ""} · {formatTokens(attempt.inputTokens)} → {formatTokens(attempt.outputTokens)}{attempt.estimated ? " (estimated)" : ""} · {attempt.cost === null ? "unpriced" : formatCost(attempt.cost)}</small>
          </div>)}
          <div><Dot tone={TONE[request.status]} /><strong>Answered {request.httpStatus}</strong><small>{request.status}{request.errorCode ? ` · ${request.errorCode}` : ""}</small></div>
        </div>
      </Panel>
      <Panel title="Request metadata">
        <div className="stack">
          <CopyField label="Request ID (x-request-id)" value={request.id} />
          <div className="list-row"><div><strong>Final provider</strong><small>{request.providerName ?? "—"} · {request.connectionName ?? "no saved connection"}</small></div></div>
          <div className="list-row"><div><strong>Final model</strong><small><code>{request.finalModel ?? "—"}</code></small></div></div>
          <div className="list-row"><div><strong>API key</strong><small>{request.keyName ?? "none (keyless mode)"}</small></div></div>
        </div>
      </Panel>
    </div>
    <Warning>Request and response bodies are never stored. Credentials and authorization headers are never recorded.</Warning>
  </>;
}
