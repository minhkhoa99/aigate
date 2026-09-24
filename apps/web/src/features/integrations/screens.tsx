import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Field, Input, PageHeading, Panel, Pill, SecretField, Table, Tabs, Warning } from "../../shared/ui";

const tools = [
  ["Claude Code", "Configured", "Anthropic CLI"], ["Codex", "Configured", "OpenAI CLI"],
  ["Cline", "Available", "VS Code extension"], ["OpenCode", "Available", "Terminal agent"],
  ["Copilot Chat", "Not detected", "VS Code extension"], ["DeepSeek TUI", "Available", "Terminal client"],
];

export function CliTools() {
  return <><PageHeading eyebrow="Integrations / CLI Tools" title="CLI tools" description="Connect local coding tools to the AIGate endpoint without exposing stored secrets." />
    <Warning>Applying a tool configuration must preserve unrelated settings and write atomically.</Warning>
    <div className="grid grid-3 section-gap">{tools.map(([name, status, detail]) => <Link className="tool-card" to="/integrations/cli-tools/codex" key={name}><div className="row between"><span className="tool-glyph">⌘</span><Pill tone={status === "Configured" ? "healthy" : status === "Available" ? "info" : "muted"}>{status}</Pill></div><strong>{name}</strong><small>{detail}</small><span className="tool-link">Manage →</span></Link>)}</div>
  </>;
}

export function CliToolDetail() {
  const [tab, setTab] = useState("Configuration");
  return <><PageHeading eyebrow="Integrations / CLI Tools / Codex" title="Codex" description="Review proposed changes before applying them to your local Codex configuration." action={<Pill tone="healthy">Configured</Pill>} />
    <Tabs items={["Configuration", "Diff preview", "Status"]} active={tab} onChange={setTab} />
    {tab === "Configuration" && <div className="split section-gap"><Panel title="AIGate connection"><div className="stack"><CopyField label="Base URL" value="http://localhost:20128/v1" /><SecretField label="API key" /><Field label="Default model"><Input defaultValue="claude-3.5-sonnet" /></Field><Button variant="primary">Apply configuration</Button></div></Panel><Panel title="Local file"><CopyField label="Path" value="~/.codex/config.toml" /><Warning>Other fields in this file remain intact when AIGate settings change.</Warning></Panel></div>}
    {tab === "Diff preview" && <Panel title="Proposed file changes" className="section-gap"><pre className="code-block"><span className="text-healthy">+ base_url = "http://localhost:20128/v1"</span>{"\n"}<span className="text-healthy">+ model = "claude-3.5-sonnet"</span>{"\n"}<span className="muted">  # Unrelated settings are preserved</span></pre></Panel>}
    {tab === "Status" && <Panel title="Installation status" className="section-gap"><div className="list-row"><div><strong>Codex detected</strong><small>Local binary and configuration file are available.</small></div><Pill tone="healthy">Ready</Pill></div></Panel>}
  </>;
}

export function Skills() {
  return <><PageHeading eyebrow="Integrations / Skills" title="Agent skills" description="Install reusable AIGate workflows into your coding agents." action={<Button variant="primary">Browse catalog</Button>} />
    <Panel title="Available skills" detail="Selected skills can be installed into supported tools." className="panel-flush"><Table columns={["Skill", "Purpose", "Installed", ""]} rows={[
      ["aigate-model-routing", "Choose a model and provider", "Installed"], ["aigate-usage", "Inspect token and cost usage", "Available"], ["aigate-provider-health", "Check provider readiness", "Available"],
    ].map((r) => [<strong>{r[0]}</strong>, r[1], <Pill tone={r[2] === "Installed" ? "healthy" : "muted"}>{r[2]}</Pill>, <Button variant="ghost">Details →</Button>])} /></Panel>
  </>;
}

export function Mcp() {
  const [tab, setTab] = useState("Servers");
  return <><PageHeading eyebrow="Integrations / MCP" title="MCP" description="Manage tool server connections and inspect their capabilities." action={<Button variant="primary">+ Add server</Button>} />
    <Tabs items={["Servers", "Tools", "Configuration"]} active={tab} onChange={setTab} />
    {tab === "Servers" && <Panel title="Connected servers" className="section-gap panel-flush"><Table columns={["Server", "Transport", "Tools", "Status", ""]} rows={[["Local filesystem", "stdio", "12", "Connected"], ["Browser bridge", "SSE", "8", "Connected"], ["Issue tracker", "HTTP", "6", "Offline"]].map((r) => [r[0], <code>{r[1]}</code>, r[2], <Pill tone={r[3] === "Connected" ? "healthy" : "muted"}>{r[3]}</Pill>, <Button variant="ghost">Manage</Button>])} /></Panel>}
    {tab === "Tools" && <Panel title="Exposed tools" className="section-gap"><div className="list-row"><div><strong>Read files</strong><small>Local filesystem · permission required</small></div><Pill tone="healthy">Available</Pill></div><div className="list-row"><div><strong>Open page</strong><small>Browser bridge · interactive session</small></div><Pill tone="healthy">Available</Pill></div></Panel>}
    {tab === "Configuration" && <Panel title="Client setup" className="section-gap"><CopyField label="MCP endpoint" value="http://localhost:20128/api/mcp" /></Panel>}
  </>;
}

