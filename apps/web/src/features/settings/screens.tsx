import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, CopyField, Field, Input, PageHeading, Panel, Pill, SecretField, StateBlock, Tabs, Warning } from "../../shared/ui";

export function SettingsGeneral() {
  return <><PageHeading eyebrow="Settings / General" title="General settings" description="Defaults for gateway operation and dashboard presentation." action={<Button variant="primary">Save changes</Button>} />
    <div className="split"><Panel title="Gateway"><div className="stack"><Field label="Instance name"><Input defaultValue="Local instance" /></Field><Field label="Preferred language"><select className="input"><option>English</option><option>Tiếng Việt</option></select></Field><Field label="Default model"><Input defaultValue="claude-3.5-sonnet" /></Field></div></Panel><Panel title="Runtime"><div className="list-row"><div><strong>Start at login</strong><small>Open the dashboard after starting AIGate.</small></div><input type="checkbox" defaultChecked aria-label="Start at login" /></div><div className="list-row"><div><strong>Enable observability</strong><small>Persist sanitized request details.</small></div><input type="checkbox" aria-label="Enable observability" /></div></Panel></div>
  </>;
}

export function SettingsAuth() {
  const [tab, setTab] = useState("Dashboard login");
  return <><PageHeading eyebrow="Settings / Auth & Access" title="Auth & access" description="Protect the dashboard and the gateway with separate access controls." />
    <Tabs items={["Dashboard login", "OIDC", "SAML", "API access"]} active={tab} onChange={setTab} />
    {tab === "Dashboard login" && <div className="split section-gap"><Panel title="Password login"><div className="stack"><SecretField label="Current password" /><Field label="New password"><Input type="password" placeholder="Enter a new password" /></Field><Field label="Confirm new password"><Input type="password" placeholder="Repeat the new password" /></Field><Button variant="primary">Change password</Button></div></Panel><Panel title="Session security"><div className="list-row"><div><strong>Require dashboard login</strong><small>Unauthenticated visitors are sent to the login page.</small></div><input type="checkbox" defaultChecked aria-label="Require dashboard login" /></div><Warning tone="danger">A public tunnel must not be enabled while login is disabled or a default password remains active.</Warning></Panel></div>}
    {tab === "OIDC" && <Panel title="OpenID Connect" className="section-gap"><div className="stack"><SecretField label="Client secret" /><Field label="Issuer URL"><Input placeholder="https://identity.example.com" /></Field><Field label="Client ID"><Input placeholder="AIGate client ID" /></Field><Button variant="primary">Save OIDC</Button></div></Panel>}
    {tab === "SAML" && <Panel title="SAML single sign-on" className="section-gap"><div className="stack"><SecretField label="Signing certificate" /><CopyField label="Assertion consumer URL" value="http://localhost:20128/api/auth/saml/acs" /><Warning>Assertions must be linked to a pending request and accepted at most once.</Warning></div></Panel>}
    {tab === "API access" && <Panel title="Gateway keys" className="section-gap"><div className="list-row"><div><strong>Require API key</strong><small>Reject requests without a valid gateway key.</small></div><input type="checkbox" defaultChecked aria-label="Require API key" /></div><Link className="button button-secondary" to="/gateway/endpoint">Manage keys →</Link></Panel>}
  </>;
}

export function SettingsDeveloper({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return <><PageHeading eyebrow="Settings / Developer" title="Developer settings" description="Diagnostics and advanced inspection for this local instance." />
    <Warning>Developer tools may expose request identifiers and provider metadata. Sensitive values remain masked.</Warning>
    <Panel title="Developer mode" detail="Enables Console and advanced diagnostics in the navigation." className="section-gap"><div className="list-row"><div><strong>Enable developer mode</strong><small>Show Console and detailed transport diagnostics.</small></div><input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} aria-label="Enable developer mode" /></div></Panel>
    <Panel title="Diagnostics" className="section-gap"><div className="list-row"><div><strong>Trace retention</strong><small>Local sanitized diagnostics only.</small></div><Pill tone="info">7 days</Pill></div><Button>Download diagnostics</Button></Panel>
  </>;
}

export function Login() {
  const [error, setError] = useState(false);
  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><h1>Welcome back</h1><p>Sign in to manage your local gateway.</p>
    {error && <Warning tone="danger"><code>ERR_AUTH_CREDENTIAL_MISMATCH</code> · The password did not match. Check it and try again.</Warning>}
    <form onSubmit={(e) => { e.preventDefault(); setError(true); }}><Field label="Password"><Input type="password" placeholder="Enter your password" /></Field><Button type="submit" variant="primary">Sign in</Button></form>
    <small>Local instance · your data stays on this machine</small></div></div>;
}

export function Callback() {
  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><h1>Completing sign-in</h1><p>Waiting for the identity provider to return a valid response.</p><StateBlock state="loading" /><Link className="button button-secondary" to="/login">Back to login</Link></div></div>;
}

export function Onboarding() {
  const [step, setStep] = useState(1);
  return <div className="standalone"><div className="onboarding-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><div className="wizard-steps">{["Secure", "Connect", "Verify"].map((s, i) => <div className={step === i + 1 ? "active" : ""} key={s}><span>{i + 1}</span>{s}</div>)}</div>
    <h1>{step === 1 ? "Secure your gateway" : step === 2 ? "Connect a provider" : "Verify your route"}</h1><p>{step === 1 ? "Set a dashboard password and require an API key before accepting traffic." : step === 2 ? "Add one account to send your first request." : "Run a safe test to confirm your gateway is ready."}</p>
    {step === 1 && <div className="stack"><Field label="Dashboard password"><Input type="password" placeholder="Create a strong password" /></Field><Field label="Confirm password"><Input type="password" placeholder="Repeat password" /></Field></div>}
    {step === 2 && <div className="stack"><Field label="Provider"><select className="input"><option>Anthropic</option><option>OpenAI</option></select></Field><Field label="API key"><Input type="password" placeholder="Paste provider credential" /></Field></div>}
    {step === 3 && <div className="stack"><StateBlock state="empty" action={<Button>Run a test request</Button>} /></div>}
    <div className="modal-actions"><Button disabled={step === 1} onClick={() => setStep(step - 1)}>Back</Button><Button variant="primary" onClick={() => setStep(Math.min(3, step + 1))}>{step === 3 ? "Open dashboard" : "Continue"}</Button></div>
  </div></div>;
}

