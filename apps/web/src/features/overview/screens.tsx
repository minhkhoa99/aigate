import { Button, CopyField, Dot, Metric, PageHeading, Panel, Pill, Table, Warning } from "../../shared/ui";

const requests = [
  ["14:02:41", "claude-3.5-sonnet", "Anthropic", "142ms", "1,420", "200"],
  ["14:02:38", "gpt-4o", "OpenAI", "280ms", "3,112", "200"],
  ["14:01:56", "deepseek-r1", "DeepSeek", "919ms", "542", "429"],
  ["14:01:49", "gemini-2.5-pro", "Google Vertex", "312ms", "2,190", "200"],
  ["14:00:57", "claude-3.7-sonnet", "Anthropic", "228ms", "4,208", "200"],
  ["13:59:33", "gpt-4o-mini", "OpenAI", "166ms", "880", "200"],
];
const providers = ["OpenAI", "Anthropic", "Azure AI", "DeepSeek", "Google AI", "Mistral", "Grok", "Together", "Fireworks", "Bedrock", "Cohere", "Perplexity", "OpenRouter", "Ollama", "Groq", "Replicate", "xAI", "Vertex AI", "Voyage AI", "RunPod"];

export function Overview() {
  return <>
    <PageHeading eyebrow="Workspace / Overview" title="Gateway overview" description="Traffic, health, and exceptions across your local AI gateway." action={<Button>Last 24 hours ⌄</Button>} />
    <div className="status-strip"><div className="row"><Pill tone="healthy">Running</Pill><span className="target-label">Target:</span><CopyField value="http://localhost:20128" /></div><div className="row muted"><span>Uptime: 4d 18h 30m</span><span>Workers: 80 active</span><span>Active conns: <b className="text-healthy">41 strong</b></span></div></div>
    <div className="grid grid-4 section-gap">
      <Metric label="Requests 24h" value="1,482,910" delta="↗ +24.3% vs yesterday" bars={[18,27,31,25,42,37,48,53,48,63,75,82]} />
      <Metric label="Tokens 24h" value="842.6M" delta="↗ +8.4% vs previous" bars={[20,24,34,25,39,42,47,52,45,54,62,67]} />
      <Metric label="Cost 24h" value="$142.85" delta="↘ -2.1% savings" bars={[45,40,38,30,35,32,24,26,28,20,17,15]} />
      <Metric label="Error rate 24h" value="0.04%" delta="↘ -0.1% improvement" bars={[30,24,28,25,15,20,12,9,13,8,9,6]} />
    </div>
    <div className="split section-gap">
      <Panel title="Live requests" detail="SSE stream active · 20 most recent" className="panel-flush" action={<div className="row"><Pill tone="healthy">Live</Pill><Button variant="ghost">View all →</Button></div>}>
        <Table columns={["Time", "Model ID", "Provider", "TTFT", "Tokens", "Status"]} rows={requests.map((r) => [<code>{r[0]}</code>, <code>{r[1]}</code>, r[2], <span className="mono">{r[3]}</span>, <span className="mono">{r[4]}</span>, <Pill tone={r[5] === "200" ? "healthy" : "warning"}>{r[5]}</Pill>])} />
      </Panel>
      <Panel title="Needs attention" detail="Actionable warnings from all systems" action={<Pill tone="warning">3 alerts</Pill>}>
        <div className="attention-list"><Warning><strong>Quota nearly exhausted</strong><small>Together · rate limit resets in 43 min</small></Warning>
          <Warning><strong>Credentials expiring soon</strong><small>OpenAI OAuth · renewal required within 3 days</small></Warning>
          <Warning tone="danger"><strong>Connection denied</strong><small>DeepSeek · token refresh failed</small></Warning></div>
      </Panel>
    </div>
    <Panel title="Provider health" detail="20 configured providers · last hour request error rate" className="section-gap" action={<div className="row muted"><span><Dot /> Healthy</span><span><Dot tone="warning" /> Degraded</span><span><Dot tone="danger" /> Down</span></div>}>
      <div className="provider-grid">{providers.map((p, i) => <div className="provider-tile" key={p}><div><strong>{p}</strong><Dot tone={i === 3 ? "warning" : i === 7 ? "danger" : "healthy"} /></div><small>{i === 7 ? "2.6%" : i === 3 ? "0.8%" : "0.0%"} error</small></div>)}</div>
    </Panel>
  </>;
}

