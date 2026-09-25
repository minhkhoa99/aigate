import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, CopyField, Field, Input, PageHeading, Panel, Pill, SecretField, StateBlock, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { ApiError, isApiError } from "../../shared/api";
import { useAuthStatus, useChangePassword, useLogin, useLogout, usePatchSettings, useSettings, useSetup } from "./api";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;

type Problem = { code: string; message: string };

function formValue(event: FormEvent<HTMLFormElement>, name: string): string {
  const value = new FormData(event.currentTarget).get(name);
  return typeof value === "string" ? value : "";
}

// Turns contract error codes (docs/contracts/identity-apikeys.md) into what the user can do next.
function describe(error: unknown): Problem {
  if (!(error instanceof ApiError)) return { code: "ERR_GATEWAY_UNAVAILABLE", message: "Could not reach the gateway. Check that AIGate is running." };
  const { remainingBeforeLock, retryAfter } = error.body;
  if (error.code === "INVALID_CREDENTIALS" && typeof remainingBeforeLock === "number") {
    return { code: error.code, message: `The password did not match. ${remainingBeforeLock} attempt(s) left before a temporary lock.` };
  }
  if (error.code === "RATE_LIMITED" && typeof retryAfter === "number") return { code: error.code, message: `Too many failed attempts. Try again in ${retryAfter}s.` };
  if (error.code === "NOT_LOCAL") return { code: error.code, message: "Set the first password on the machine running AIGate, or start AIGate with AIGATE_INITIAL_PASSWORD." };
  return { code: error.code, message: error.message };
}

export function SettingsGeneral() {
  return <><PageHeading eyebrow="Settings / General" title="General settings" description="Defaults for gateway operation and dashboard presentation." action={<Button variant="primary">Save changes</Button>} />
    <div className="split"><Panel title="Gateway"><div className="stack"><Field label="Instance name"><Input defaultValue="Local instance" /></Field><Field label="Preferred language"><select className="input"><option>English</option><option>Tiếng Việt</option></select></Field><Field label="Default model"><Input defaultValue="claude-3.5-sonnet" /></Field></div></Panel><Panel title="Runtime"><div className="list-row"><div><strong>Start at login</strong><small>Open the dashboard after starting AIGate.</small></div><input type="checkbox" defaultChecked aria-label="Start at login" /></div><div className="list-row"><div><strong>Enable observability</strong><small>Persist sanitized request details.</small></div><input type="checkbox" aria-label="Enable observability" /></div></Panel></div>
  </>;
}

export function SettingsAuth() {
  const [tab, setTab] = useState("Dashboard login");
  const settings = useSettings();
  const patch = usePatchSettings();
  const changePassword = useChangePassword();
  const logout = useLogout();
  const navigate = useNavigate();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", ...describe(error) });
  const busy = !settings.data || patch.isPending;

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const newPassword = formValue(event, "newPassword");
    if (newPassword !== formValue(event, "confirmPassword")) {
      showToast({ tone: "error", code: "INVALID_REQUEST", message: "The new passwords do not match." });
      return;
    }
    changePassword.mutate({ currentPassword: formValue(event, "currentPassword"), newPassword }, {
      onSuccess: () => { form.reset(); showToast({ tone: "success", message: "Password changed. Every other session was signed out." }); },
      onError: fail,
    });
  };

  return <><PageHeading eyebrow="Settings / Auth & Access" title="Auth & access" description="Protect the dashboard and the gateway with separate access controls." />
    <Tabs items={["Dashboard login", "OIDC", "SAML", "API access"]} active={tab} onChange={setTab} />
    {settings.isError && <Warning tone="danger"><code>{describe(settings.error).code}</code> · Could not load the current settings.</Warning>}
    {tab === "Dashboard login" && <div className="split section-gap"><Panel title="Password login"><form className="stack" onSubmit={submitPassword}>
      <Field label="Current password"><Input type="password" name="currentPassword" required maxLength={MAX_PASSWORD} autoComplete="current-password" placeholder="Enter your current password" /></Field>
      <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}><Input type="password" name="newPassword" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Enter a new password" /></Field>
      <Field label="Confirm new password"><Input type="password" name="confirmPassword" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Repeat the new password" /></Field>
      <Button type="submit" variant="primary" disabled={changePassword.isPending}>{changePassword.isPending ? "Changing…" : "Change password"}</Button></form></Panel>
      <Panel title="Session security"><div className="list-row"><div><strong>Require dashboard login</strong><small>When off, only this machine may skip sign-in; remote visitors still sign in.</small></div><input type="checkbox" checked={settings.data?.requireLogin ?? true} disabled={busy} onChange={(e) => patch.mutate({ requireLogin: e.target.checked }, { onError: fail })} aria-label="Require dashboard login" /></div><Warning tone="danger">A public tunnel must not be enabled while login is disabled or a default password remains active.</Warning>
        <Button onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/login" }), onError: fail })} disabled={logout.isPending}>Sign out</Button></Panel></div>}
    {tab === "OIDC" && <Panel title="OpenID Connect" className="section-gap"><div className="stack"><SecretField label="Client secret" /><Field label="Issuer URL"><Input placeholder="https://identity.example.com" /></Field><Field label="Client ID"><Input placeholder="AIGate client ID" /></Field><Button variant="primary">Save OIDC</Button></div></Panel>}
    {tab === "SAML" && <Panel title="SAML single sign-on" className="section-gap"><div className="stack"><SecretField label="Signing certificate" /><CopyField label="Assertion consumer URL" value="http://localhost:20128/api/auth/saml/acs" /><Warning>Assertions must be linked to a pending request and accepted at most once.</Warning></div></Panel>}
    {tab === "API access" && <Panel title="Gateway keys" className="section-gap"><div className="list-row"><div><strong>Require API key</strong><small>Reject requests without a valid gateway key.</small></div><input type="checkbox" checked={settings.data?.requireApiKey ?? true} disabled={busy} onChange={(e) => patch.mutate({ requireApiKey: e.target.checked }, { onError: fail })} aria-label="Require API key" /></div><Link className="button button-secondary" to="/gateway/endpoint">Manage keys →</Link></Panel>}
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
  const navigate = useNavigate();
  const status = useAuthStatus();
  const login = useLogin();
  const showToast = useToast();
  const [error, setError] = useState<Problem | null>(null);

  useEffect(() => {
    if (status.data?.setupRequired) void navigate({ to: "/welcome" });
    else if (status.data?.authenticated) void navigate({ to: "/" });
  }, [status.data, navigate]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ password: formValue(event, "password") }, {
      onSuccess: () => void navigate({ to: "/" }),
      onError: (err) => {
        if (isApiError(err, "SETUP_REQUIRED")) { void navigate({ to: "/welcome" }); return; }
        const problem = describe(err);
        setError(problem);
        showToast({ tone: "error", ...problem });
      },
    });
  };

  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><h1>Welcome back</h1><p>Sign in to manage your local gateway.</p>
    {error && <Warning tone="danger"><code>{error.code}</code> · {error.message}</Warning>}
    <form onSubmit={submit}><Field label="Password"><Input type="password" name="password" required maxLength={MAX_PASSWORD} autoComplete="current-password" placeholder="Enter your password" /></Field><Button type="submit" variant="primary" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</Button></form>
    <small>Local instance · your data stays on this machine</small></div></div>;
}

export function Callback() {
  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><h1>Completing sign-in</h1><p>Waiting for the identity provider to return a valid response.</p><StateBlock state="loading" /><Link className="button button-secondary" to="/login">Back to login</Link></div></div>;
}

export function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const status = useAuthStatus();
  const setup = useSetup();
  const showToast = useToast();
  const [error, setError] = useState<Problem | null>(null);

  // Nothing to set up on an install that already has a password; this setup call is excluded.
  useEffect(() => {
    if (step === 1 && status.data && !status.data.setupRequired && setup.isIdle) void navigate({ to: status.data.authenticated ? "/" : "/login" });
  }, [step, status.data, setup.isIdle, navigate]);

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = formValue(event, "password");
    if (password !== formValue(event, "confirm")) { setError({ code: "INVALID_REQUEST", message: "The passwords do not match." }); return; }
    setup.mutate({ password }, {
      onSuccess: () => { setError(null); setStep(2); },
      onError: (err) => {
        if (isApiError(err, "ALREADY_SET_UP")) { void navigate({ to: "/login" }); return; }
        const problem = describe(err);
        setError(problem);
        showToast({ tone: "error", ...problem });
      },
    });
  };

  return <div className="standalone"><div className="onboarding-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><div className="wizard-steps">{["Secure", "Connect", "Verify"].map((s, i) => <div className={step === i + 1 ? "active" : ""} key={s}><span>{i + 1}</span>{s}</div>)}</div>
    <h1>{step === 1 ? "Secure your gateway" : step === 2 ? "Connect a provider" : "Verify your route"}</h1><p>{step === 1 ? "Set a dashboard password and require an API key before accepting traffic." : step === 2 ? "Add one account to send your first request." : "Run a safe test to confirm your gateway is ready."}</p>
    {step === 1 && <form onSubmit={submitPassword}><div className="stack"><Field label="Dashboard password" hint={`At least ${MIN_PASSWORD} characters.`}><Input type="password" name="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Create a strong password" /></Field><Field label="Confirm password"><Input type="password" name="confirm" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Repeat password" /></Field></div>
      {error && <Warning tone="danger"><code>{error.code}</code> · {error.message}</Warning>}
      <div className="modal-actions"><Button disabled>Back</Button><Button type="submit" variant="primary" disabled={setup.isPending}>{setup.isPending ? "Saving…" : "Continue"}</Button></div></form>}
    {step === 2 && <div className="stack"><Field label="Provider"><select className="input"><option>Anthropic</option><option>OpenAI</option></select></Field><Field label="API key"><Input type="password" placeholder="Paste provider credential" /></Field><Warning>Provider connections arrive in a later milestone. Continue to finish setup; nothing here is saved yet.</Warning></div>}
    {step === 3 && <div className="stack"><StateBlock state="empty" action={<Button>Run a test request</Button>} /></div>}
    {step > 1 && <div className="modal-actions"><Button onClick={() => setStep(step - 1)} disabled={step === 2}>Back</Button><Button variant="primary" onClick={() => (step === 3 ? void navigate({ to: "/" }) : setStep(step + 1))}>{step === 3 ? "Open dashboard" : "Continue"}</Button></div>}
  </div></div>;
}
