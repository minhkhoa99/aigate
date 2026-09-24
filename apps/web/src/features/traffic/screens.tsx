import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Dot, Input, Metric, PageHeading, Panel, Pill, Table, Warning } from "../../shared/ui";

const requestRows = [
  ["req_01J9A2", "14:02:41", "claude-3.5-sonnet", "Anthropic", "1,420", "$0.0042", "200"],
  ["req_01J9A1", "14:02:38", "gpt-4o", "OpenAI", "3,112", "$0.0124", "200"],
  ["req_01J9A0", "14:01:56", "deepseek-r1", "DeepSeek", "542", "$0.0018", "429"],
  ["req_01J99Z", "14:01:49", "gemini-2.5-pro", "Google Vertex", "2,190", "$0.0036", "200"],
  ["req_01J99Y", "14:00:57", "claude-3.7-sonnet", "Anthropic", "4,208", "$0.0161", "200"],
];
const bars = [24,30,26,40,38,51,63,54,48,70,59,76,72,82,68,91,76,84,71,88,94,79,96,83];

export function Usage() {
  const [period, setPeriod] = useState("24 hours");
  return <><PageHeading eyebrow="Traffic / Usage" title="Usage analytics" description="Monitor request volume, token consumption, and cost by provider." action={<Button onClick={() => setPeriod(period === "24 hours" ? "7 days" : "24 hours")}>{period} ⌄</Button>} />
    <div className="grid grid-4"><Metric label="Total requests" value="1.48M" delta="↗ +24.3%" /><Metric label="Input tokens" value="604.2M" delta="↗ +10.1%" /><Metric label="Output tokens" value="238.4M" delta="↗ +7.2%" /><Metric label="Estimated cost" value="$142.85" delta="↘ -2.1%" /></div>
    <Panel title="Requests over time" detail={`Bucketed usage · last ${period}`} className="section-gap"><div className="chart-bars" role="img" aria-label="Requests trend rises through the selected period">{bars.map((bar, i) => <span key={i} style={{ height: `${bar}%` }} />)}</div><div className="chart-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div></Panel>
    <div className="grid grid-2 section-gap"><Panel title="Cost by provider"><Table columns={["Provider", "Requests", "Cost"]} rows={[["Anthropic", "402K", "$63.20"],["OpenAI", "389K", "$48.10"],["Google Vertex", "321K", "$21.34"],["DeepSeek", "114K", "$10.21"]]} /></Panel><Panel title="Top models"><Table columns={["Model", "Tokens", "Share"]} rows={[["claude-3.5-sonnet", "204M", "24%"],["gpt-4o", "187M", "22%"],["gemini-2.5-pro", "146M", "17%"],["deepseek-r1", "103M", "12%"]].map((r) => [<code>{r[0]}</code>, <span className="mono">{r[1]}</span>, r[2]])} /></Panel></div>
  </>;
}

export function Requests() {
  const [status, setStatus] = useState("All statuses");
  const visible = status === "All statuses" ? requestRows : requestRows.filter((r) => r[6] === "429");
  return <><PageHeading eyebrow="Traffic / Requests" title="Requests" description="Trace each request from inbound client to provider response." action={<Button>Export CSV</Button>} />
    <Panel title="Request history" detail="Credential values and request bodies are never shown." className="panel-flush"><div className="table-toolbar"><Input placeholder="Search request ID or model" /><select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status"><option>All statuses</option><option>429</option></select><Button>Provider ⌄</Button><Button>Time range ⌄</Button></div>
      <Table columns={["Request ID", "Time", "Model", "Provider", "Tokens", "Cost", "Status"]} rows={visible.map((r) => [<Link className="table-link mono" to="/traffic/requests/request-123">{r[0]}</Link>, <span className="mono">{r[1]}</span>, <code>{r[2]}</code>, r[3], <span className="mono">{r[4]}</span>, <span className="mono">{r[5]}</span>, <Pill tone={r[6] === "200" ? "healthy" : "warning"}>{r[6]}</Pill>])} />
    </Panel></>;
}

export function RequestDetail() {
  return <><PageHeading eyebrow="Traffic / Requests / req_01J9A2" title="Request detail" description="Timing, model resolution, attempts, and sanitized metadata." action={<Pill tone="healthy">200 OK</Pill>} />
    <div className="grid grid-4"><Metric label="Total latency" value="1.28s" /><Metric label="Time to first token" value="142ms" /><Metric label="Tokens" value="1,420" /><Metric label="Estimated cost" value="$0.0042" /></div>
    <div className="split section-gap"><Panel title="Attempt timeline" detail="One provider request completed successfully"><div className="timeline"><div><Dot /><strong>Inbound request</strong><small>14:02:40.112 · API key validated</small></div><div><Dot /><strong>Model resolved</strong><small>claude-3.5-sonnet → Anthropic</small></div><div><Dot /><strong>Connection selected</strong><small>Anthropic primary · healthy</small></div><div><Dot /><strong>First token</strong><small>+142ms · SSE stream opened</small></div><div><Dot /><strong>Completed</strong><small>+1.28s · usage recorded</small></div></div></Panel>
      <Panel title="Request metadata"><div className="stack"><CopyField label="Request ID" value="req_01J9A2" /><CopyField label="Trace ID" value="trc_8dd9e42" /><div className="list-row"><div><strong>Provider</strong><small>Anthropic · direct transport</small></div><Pill tone="healthy">Healthy</Pill></div><div className="list-row"><div><strong>Client response</strong><small>Streaming · OpenAI compatible</small></div><Pill tone="healthy">Finished</Pill></div></div></Panel></div>
    <Warning>Request and response bodies are excluded from this view. Credentials and authorization headers are never displayed.</Warning>
  </>;
}

export function Console() {
  const [level, setLevel] = useState("All levels");
  return <><PageHeading eyebrow="Traffic / Developer" title="Console log" description="Live gateway diagnostics with bounded history and sanitized fields." action={<div className="row"><Pill tone="healthy">Streaming</Pill><Button>Pause</Button><Button>Clear view</Button></div>} />
    <Warning>Developer mode is on. Logs may include model names and request IDs, but never credentials or prompt bodies.</Warning>
    <Panel title="Events" className="section-gap panel-flush"><div className="table-toolbar"><select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter log level"><option>All levels</option><option>Warnings</option><option>Errors</option></select><Input placeholder="Filter messages" /></div><div className="console-lines" role="log" aria-live="polite">
      {["14:02:41.392  INFO   response completed req_01J9A2 · 200 · 1,420 tokens", "14:02:38.211  INFO   connection selected openai-primary · gpt-4o", "14:01:56.032  WARN   provider quota near limit deepseek-primary", "14:01:49.441  INFO   SSE stream started · gemini-2.5-pro", "14:00:57.120  INFO   usage snapshot persisted req_01J99Y"].filter((x) => level === "All levels" || (level === "Warnings" ? x.includes("WARN") : x.includes("ERROR"))).map((line) => <div key={line}>{line}</div>)}
    </div></Panel></>;
}
