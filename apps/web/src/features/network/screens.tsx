import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, CopyField, Dot, Field, Input, PageHeading, Panel, Pill, Table, Warning } from "../../shared/ui";

export function ProxyPools() {
  const [remove, setRemove] = useState<string | null>(null);
  return <><PageHeading eyebrow="Network / Proxy Pools" title="Proxy pools" description="Route outbound provider requests through controlled network paths." action={<Link className="button button-primary" to="/network/proxy-pools/deploy">+ Deploy relay</Link>} />
    <Warning>When strict proxy is enabled, a failed proxy must fail the request instead of falling back to direct traffic.</Warning>
    <Panel title="Configured pools" detail="HTTP proxies and hosted relays" className="section-gap panel-flush"><Table columns={["Pool", "Type", "Connections", "Strict proxy", "Health", ""]} rows={[
      ["Primary egress", "HTTP", "12", "On", "Healthy"], ["Cloudflare relay", "Cloudflare", "4", "Off", "Healthy"], ["Deno backup", "Deno", "2", "On", "Degraded"],
    ].map((r) => [r[0], <code>{r[1]}</code>, <span className="mono">{r[2]}</span>, <Pill tone={r[3] === "On" ? "info" : "muted"}>{r[3]}</Pill>, <Pill tone={r[4] === "Healthy" ? "healthy" : "warning"}>{r[4]}</Pill>, <Button variant="ghost" onClick={() => setRemove(r[0])}>Manage</Button>])} /></Panel>
    {remove && <ConfirmDialog name={remove} onClose={() => setRemove(null)} onConfirm={() => setRemove(null)} />}
  </>;
}

export function DeployWizard() {
  const [step, setStep] = useState(1);
  return <><PageHeading eyebrow="Network / Proxy Pools / Deploy" title="Deploy a relay" description="Create a hosted relay and attach it to a proxy pool." />
    <div className="wizard-steps">{["Platform", "Credentials", "Review"].map((s, i) => <div key={s} className={step === i + 1 ? "active" : ""}><span>{i + 1}</span>{s}</div>)}</div>
    <div className="split section-gap"><Panel title={step === 1 ? "Choose platform" : step === 2 ? "Deployment credentials" : "Review deployment"}>
      {step === 1 && <div className="stack"><label className="choice-card"><input type="radio" name="platform" defaultChecked /> Vercel Edge relay <small>Managed edge deployment</small></label><label className="choice-card"><input type="radio" name="platform" /> Cloudflare Worker <small>Global worker relay</small></label><label className="choice-card"><input type="radio" name="platform" /> Deno Deploy <small>Serverless app relay</small></label></div>}
      {step === 2 && <div className="stack"><Field label="Deployment token"><Input type="password" placeholder="Paste a new token" /></Field><Field label="Project name"><Input placeholder="aigate-relay" /></Field><Warning>Token values are used for deployment and never shown again after saving.</Warning></div>}
      {step === 3 && <div className="stack"><div className="list-row"><div><strong>Platform</strong><small>Vercel Edge relay</small></div><Pill tone="info">Selected</Pill></div><div className="list-row"><div><strong>Proxy policy</strong><small>Fail closed when strict proxy is enabled</small></div><Pill tone="healthy">Safe</Pill></div></div>}
      <div className="modal-actions"><Button disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1))}>Back</Button><Button variant="primary" onClick={() => setStep(Math.min(3, step + 1))}>{step === 3 ? "Deploy relay" : "Continue"}</Button></div>
    </Panel><Panel title="Deployment state"><div className="flow-steps">{["Create relay", "Wait for readiness", "Validate endpoint", "Attach pool"].map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, "0")}</span><strong>{s}</strong><Pill>{step === 3 && i === 0 ? "Ready" : "Pending"}</Pill></div>)}</div></Panel></div>
  </>;
}

export function Tunnel() {
  const [enabled, setEnabled] = useState(false);
  return <><PageHeading eyebrow="Network / Tunnel" title="Remote access" description="Expose the local gateway through a managed tunnel only when access controls are safe." />
    <Warning tone="danger">Before enabling public access, require an API key and secure dashboard login. This must also be enforced by the server.</Warning>
    <div className="grid grid-2 section-gap"><Panel title="Cloudflare Tunnel" detail="Gateway access via your Cloudflare account" action={<Pill tone={enabled ? "healthy" : "muted"}>{enabled ? "Enabled" : "Not configured"}</Pill>}><div className="stack"><p className="muted">Create a tunnel and bind it to a hostname you control.</p><Field label="Public hostname"><Input placeholder="gateway.example.com" /></Field><Button variant="primary" onClick={() => setEnabled(!enabled)}>{enabled ? "Disable tunnel" : "Enable tunnel"}</Button></div></Panel>
      <Panel title="Tailscale Funnel" detail="Share the gateway across your tailnet" action={<Pill>Not configured</Pill>}><div className="stack"><p className="muted">Funnel requires a secure local endpoint and an authenticated tailnet.</p><Button>Configure Tailscale</Button></div></Panel></div>
    <Panel title="Current access" className="section-gap"><CopyField label="Local endpoint" value="http://localhost:20128/v1" /><div className="list-row"><Dot /><div><strong>Gateway reachable locally</strong><small>Public endpoint disabled by default.</small></div><Pill tone="healthy">Private</Pill></div></Panel>
  </>;
}

export function Mitm() {
  const [remove, setRemove] = useState(false);
  return <><PageHeading eyebrow="Network / MITM" title="Local interception" description="Capture supported IDE traffic through a local trusted proxy." />
    <Warning tone="danger"><strong>System trust changes.</strong> Installing a local certificate authority affects the operating system trust store. Review the certificate and affected hosts before continuing.</Warning>
    <div className="grid grid-2 section-gap"><Panel title="Certificate authority" detail="Generate and inspect the local CA before installing it"><div className="stack"><div className="list-row"><div><strong>CA certificate</strong><small>Not installed on this device</small></div><Pill>Absent</Pill></div><Button>Generate CA</Button><div className="danger-actions"><Button variant="primary">Install CA</Button><Button variant="danger" onClick={() => setRemove(true)}>Remove CA</Button></div></div></Panel>
      <Panel title="Interception targets"><Table columns={["Host", "State"]} rows={[["api.anthropic.com", "Disabled"], ["api.openai.com", "Disabled"], ["generativelanguage.googleapis.com", "Disabled"]].map((r) => [<code>{r[0]}</code>, <Pill>{r[1]}</Pill>])} /></Panel></div>
    {remove && <ConfirmDialog name="Local CA" onClose={() => setRemove(false)} onConfirm={() => setRemove(false)} />}
  </>;
}

