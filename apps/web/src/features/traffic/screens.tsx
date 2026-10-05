import { useState } from "react";
import { Button, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useConsoleLogs } from "./api";

export { Usage } from "./usage";
export { RequestDetail, Requests } from "./requests";


export function Console() {
  const [level, setLevel] = useState("All levels");
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const { query, connected, stopped, clear } = useConsoleLogs(!paused);
  const toast = useToast();
  const rows = (query.data ?? []).filter((row) => (level === "All levels" || (level === "Warnings" ? row.level === "WARN" : row.level === "ERROR")) && row.message.toLowerCase().includes(filter.toLowerCase()));
  return <><PageHeading eyebrow="Traffic / Developer" title="Console log" description="Recent request diagnostics with bounded history and sanitized metadata." action={<div className="row"><Pill tone={connected ? "healthy" : "muted"}>{paused ? "Paused" : stopped ? "Stopped" : connected ? "Live" : "Connecting"}</Pill><Button onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</Button><Button onClick={() => void clear().catch((error) => toast({ tone: "error", ...toProblem(error) }))}>Clear log</Button></div>} />
    <Warning>Only request metadata is recorded here. Prompt and response bodies, credentials, and provider keys are never included.</Warning>
    <Panel title="Events" className="section-gap panel-flush"><div className="table-toolbar"><select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter log level"><option>All levels</option><option>Warnings</option><option>Errors</option></select><input className="input" placeholder="Filter messages" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
      {query.isPending ? <StateBlock state="loading" /> : query.isError ? <StateBlock state="error" code={toProblem(query.error).code} action={<Button onClick={() => void query.refetch()}>Retry</Button>} />
        : <div className="console-lines" role="log" aria-live="polite">{rows.map((row) => <div key={row.id}><time>{new Date(row.at).toLocaleTimeString()}</time> <strong>{row.level}</strong> {row.message}</div>)}{rows.length === 0 && <p className="muted">No request events yet. Send a request through AIGate to see it here.</p>}</div>}
    </Panel></>;
}
