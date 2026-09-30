import { useState } from "react";
import { Button, Input, PageHeading, Panel, Pill, Warning } from "../../shared/ui";

export { Usage } from "./usage";
export { RequestDetail, Requests } from "./requests";


export function Console() {
  const [level, setLevel] = useState("All levels");
  return <><PageHeading eyebrow="Traffic / Developer" title="Console log" description="Live gateway diagnostics with bounded history and sanitized fields." action={<div className="row"><Pill tone="healthy">Streaming</Pill><Button>Pause</Button><Button>Clear view</Button></div>} />
    <Warning>Developer mode is on. Logs may include model names and request IDs, but never credentials or prompt bodies.</Warning>
    <Panel title="Events" className="section-gap panel-flush"><div className="table-toolbar"><select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter log level"><option>All levels</option><option>Warnings</option><option>Errors</option></select><Input placeholder="Filter messages" /></div><div className="console-lines" role="log" aria-live="polite">
      {["14:02:41.392  INFO   response completed req_01J9A2 · 200 · 1,420 tokens", "14:02:38.211  INFO   connection selected openai-primary · gpt-4o", "14:01:56.032  WARN   provider quota near limit deepseek-primary", "14:01:49.441  INFO   SSE stream started · gemini-2.5-pro", "14:00:57.120  INFO   usage snapshot persisted req_01J99Y"].filter((x) => level === "All levels" || (level === "Warnings" ? x.includes("WARN") : x.includes("ERROR"))).map((line) => <div key={line}>{line}</div>)}
    </div></Panel></>;
}
