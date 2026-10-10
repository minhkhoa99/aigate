import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, CopyField, Field, Input, PageHeading, Panel, SecretField, StateBlock, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { isApiError } from "../../shared/api";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { createFormatters, type Message } from "../../shared/i18n";
import { downloadSettingsFile, useAuthStatus, useChangePassword, useLogin, useLogout, usePatchSettings, useRuntimeInfo, useSettings, useSetup } from "./api";
import { OAUTH_CHANNEL, type CallbackData } from "../providers/sign-in";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;
export { SettingsGeneral } from "./general";

function formValue(event: FormEvent<HTMLFormElement>, name: string): string {
  const value = new FormData(event.currentTarget).get(name);
  return typeof value === "string" ? value : "";
}

export function SettingsAuth() {
  const { language, t } = useLocale();
  const f = useMemo(() => createFormatters(language), [language]);
  const [tab, setTab] = useState("Dashboard login");
  const settings = useSettings();
  const patch = usePatchSettings();
  const changePassword = useChangePassword();
  const logout = useLogout();
  const navigate = useNavigate();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", error });
  const busy = !settings.data || patch.isPending;

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const newPassword = formValue(event, "newPassword");
    if (newPassword !== formValue(event, "confirmPassword")) {
      showToast({ tone: "error", code: "INVALID_REQUEST", localized: { key: "auth.newPasswordMismatch" } });
      return;
    }
    changePassword.mutate({ currentPassword: formValue(event, "currentPassword"), newPassword }, {
      onSuccess: () => { form.reset(); showToast({ tone: "success", localized: { key: "auth.passwordChanged" } }); },
      onError: fail,
    });
  };

  return <><PageHeading eyebrow={t("auth.eyebrow")} title={t("auth.title")} description={t("auth.description")} />
    <Tabs items={["Dashboard login", "OIDC", "SAML", "API access"]} active={tab} onChange={setTab} getLabel={item => item === "Dashboard login" ? t("auth.dashboardTab") : item === "API access" ? t("auth.apiTab") : item} />
    {settings.isError && <Warning tone="danger"><code>{toProblem(settings.error, language).code}</code> · {t("auth.loadFailed")} {toProblem(settings.error, language).message}</Warning>}
    {tab === "Dashboard login" && <div className="split section-gap"><Panel title={t("auth.passwordLogin")}><form className="stack" onSubmit={submitPassword}>
      <Field label={t("auth.currentPassword")}><Input type="password" name="currentPassword" required maxLength={MAX_PASSWORD} autoComplete="current-password" placeholder={t("auth.currentPlaceholder")} /></Field>
      <Field label={t("auth.newPassword")} hint={t("auth.minimumLength", { count: f.number(MIN_PASSWORD) })}><Input type="password" name="newPassword" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder={t("auth.newPlaceholder")} /></Field>
      <Field label={t("auth.confirmNew")}><Input type="password" name="confirmPassword" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder={t("auth.repeatNew")} /></Field>
      <Button type="submit" variant="primary" disabled={changePassword.isPending}>{t(changePassword.isPending ? "auth.changing" : "auth.changePassword")}</Button></form></Panel>
      <Panel title={t("auth.sessionSecurity")}><div className="list-row"><div><strong>{t("auth.requireLogin")}</strong><small>{t("auth.localHint")}</small></div><input type="checkbox" checked={settings.data?.requireLogin ?? true} disabled={busy} onChange={(e) => patch.mutate({ requireLogin: e.target.checked }, { onError: fail })} aria-label={t("auth.requireLogin")} /></div><Warning tone="danger">{t("auth.tunnelWarning")}</Warning>
        <Button onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/login" }), onError: fail })} disabled={logout.isPending}>{t("auth.signOut")}</Button></Panel></div>}
    {tab === "OIDC" && <Panel title={t("auth.oidcTitle")} detail={t("auth.oidcDescription")} className="section-gap"><div className="stack"><SecretField label={t("auth.clientSecret")} /><Field label={t("auth.issuer")}><Input placeholder="https://identity.example.com" /></Field><Field label={t("auth.clientId")}><Input placeholder={t("auth.clientIdPlaceholder")} /></Field><Button variant="primary">{t("auth.saveOidc")}</Button></div></Panel>}
    {tab === "SAML" && <Panel title={t("auth.samlTitle")} detail={t("auth.samlDescription")} className="section-gap"><div className="stack"><SecretField label={t("auth.certificate")} /><CopyField label={t("auth.assertionUrl")} value="http://localhost:20128/api/auth/saml/acs" /><Warning>{t("auth.assertionWarning")}</Warning></div></Panel>}
    {tab === "API access" && <Panel title={t("auth.gatewayKeys")} className="section-gap"><div className="list-row"><div><strong>{t("auth.requireKey")}</strong><small>{t("auth.rejectHint")}</small></div><input type="checkbox" checked={settings.data?.requireApiKey ?? true} disabled={busy} onChange={(e) => patch.mutate({ requireApiKey: e.target.checked }, { onError: fail })} aria-label={t("auth.requireKey")} /></div><Field label={t("auth.accountSelection")} hint={t("auth.strategyHint")}><select className="input" value={settings.data?.fallbackStrategy ?? "fill-first"} disabled={busy} onChange={(e) => patch.mutate({ fallbackStrategy: e.target.value === "round-robin" ? "round-robin" : "fill-first" }, { onError: fail })}><option value="fill-first">{t("auth.fillFirst")}</option><option value="round-robin">{t("auth.roundRobin")}</option></select></Field><Link className="button button-secondary" to="/gateway/endpoint">{t("auth.manageKeys")}</Link></Panel>}
  </>;
}

export function SettingsDeveloper({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const { language, t } = useLocale();
  const f = useMemo(() => createFormatters(language), [language]);
  const runtime = useRuntimeInfo();
  const showToast = useToast();
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try { await downloadSettingsFile("runtime"); }
    catch (error) { showToast({ tone: "error", error }); }
    finally { setDownloading(false); }
  };
  return <><PageHeading eyebrow={t("developer.eyebrow")} title={t("developer.title")} description={t("developer.description")} />
    <Warning>{t("developer.warning")}</Warning>
    <Panel title={t("developer.mode")} detail={t("developer.modeHint")} className="section-gap"><div className="list-row"><div><strong>{t("developer.enable")}</strong><small>{t("developer.enableHint")}</small></div><input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} aria-label={t("developer.enable")} /></div></Panel>
    <Panel title={t("developer.diagnostics")} className="section-gap">
      {runtime.error ? <Warning tone="danger"><code>{toProblem(runtime.error, language).code}</code> · {toProblem(runtime.error, language).message}<Button onClick={() => { void runtime.refetch(); }}>{t("common.retry")}</Button></Warning>
        : !runtime.data ? <StateBlock state="loading" /> : <>
          <div className="list-row"><div><strong>{t("developer.retention")}</strong><small>{t("developer.retentionHint")}</small></div><span>{t("settings.days", { count: f.number(runtime.data.usageRetentionDays) })}</span></div>
          <p className="muted">{t("developer.dailyHint", { days: f.number(runtime.data.dailyRetentionDays) })}</p>
          <p className="muted">{t("developer.writer", { queued: f.number(runtime.data.writer.queued), dropped: f.number(runtime.data.writer.dropped), failed: f.number(runtime.data.writer.failed) })}</p>
        </>}
      <Button onClick={() => { void download(); }} disabled={downloading}>{t("settings.downloadRuntime")}</Button><p className="muted">{t("developer.downloadHint")}</p>
    </Panel>
  </>;
}

export function Login() {
  const { language, t } = useLocale();
  const navigate = useNavigate();
  const status = useAuthStatus();
  const login = useLogin();
  const showToast = useToast();
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const error = failure ? toProblem(failure.error, language) : null;

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
        setFailure({ error: err });
        showToast({ tone: "error", error: err });
      },
    });
  };

  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div><h1>{t("auth.welcomeBack")}</h1><p>{t("auth.loginHint")}</p>
    {error && <Warning tone="danger"><code>{error.code}</code> · {error.message}</Warning>}
    <form onSubmit={submit}><Field label={t("auth.password")}><Input type="password" name="password" required maxLength={MAX_PASSWORD} autoComplete="current-password" placeholder={t("auth.passwordPlaceholder")} /></Field><Button type="submit" variant="primary" disabled={login.isPending}>{t(login.isPending ? "auth.signingIn" : "auth.signIn")}</Button></form>
    <small>{t("auth.localInstance")}</small></div></div>;
}

// docs/contracts/oauth.md: the provider's sign-in page returns here; the code goes back to the dashboard window that
// opened it (postMessage to this origin only), or over a broadcast channel when there is no opener.
const CALLBACK_FIELDS = [["code", "code"], ["token", "token"], ["state", "state"], ["error", "error"], ["errorDescription", "error_description"]] as const;

export function Callback() {
  const { t } = useLocale();
  const [delivered, setDelivered] = useState<boolean | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const data: CallbackData = {};
    for (const [key, name] of CALLBACK_FIELDS) {
      const value = query.get(name);
      if (value) data[key] = value;
    }
    if (!data.code && !data.token && !data.error) { setDelivered(false); return undefined; }
    if (window.opener) window.opener.postMessage({ type: "oauth_callback", data }, window.location.origin);
    else { const channel = new BroadcastChannel(OAUTH_CHANNEL); channel.postMessage(data); channel.close(); }
    setDelivered(true);
    const timer = setTimeout(() => window.close(), 1500);
    return () => clearTimeout(timer);
  }, []);
  return <div className="standalone"><div className="auth-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div>
    <h1>{t(delivered === false ? "auth.callbackEmpty" : "auth.callbackWorking")}</h1>
    <p>{t(delivered === false ? "auth.callbackEmptyHint" : "auth.callbackHint")}</p>
    {delivered !== false && <CopyField label={t("auth.pageAddress")} value={window.location.href} />}
    <Link className="button button-secondary" to="/providers/connections">{t("auth.backConnections")}</Link></div></div>;
}

// First run is a single step: set the dashboard password, then open the dashboard. Providers are
// connected later from the Providers screens (user decision, 2026-09-25).
export function Onboarding() {
  const { language, t } = useLocale();
  const navigate = useNavigate();
  const status = useAuthStatus();
  const setup = useSetup();
  const showToast = useToast();
  const [failure, setFailure] = useState<{ error: unknown } | { localized: Message; code: string } | null>(null);
  const error = !failure ? null : "error" in failure ? toProblem(failure.error, language) : { code: failure.code, message: t(failure.localized.key, failure.localized.params) };

  // Nothing to set up on an install that already has a password; this setup call is excluded.
  useEffect(() => {
    if (status.data && !status.data.setupRequired && setup.isIdle) void navigate({ to: status.data.authenticated ? "/" : "/login" });
  }, [status.data, setup.isIdle, navigate]);

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = formValue(event, "password");
    if (password !== formValue(event, "confirm")) { setFailure({ code: "INVALID_REQUEST", localized: { key: "auth.passwordMismatch" } }); return; }
    setup.mutate({ password }, {
      onSuccess: () => void navigate({ to: "/" }),
      onError: (err) => {
        if (isApiError(err, "ALREADY_SET_UP")) { void navigate({ to: "/login" }); return; }
        setFailure({ error: err });
        showToast({ tone: "error", error: err });
      },
    });
  };

  return <div className="standalone"><div className="onboarding-card"><div className="auth-brand"><span>⌘</span><strong>AIGate</strong></div>
    <h1>{t("auth.secureGateway")}</h1><p>{t("auth.setupHint")}</p>
    <form onSubmit={submitPassword}><div className="stack"><Field label={t("auth.dashboardPassword")} hint={t("auth.minimumLength", { count: MIN_PASSWORD })}><Input type="password" name="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder={t("auth.createPassword")} /></Field><Field label={t("auth.confirmPassword")}><Input type="password" name="confirm" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder={t("auth.repeatPassword")} /></Field></div>
      {error && <Warning tone="danger"><code>{error.code}</code> · {error.message}</Warning>}
      <div className="modal-actions"><Button type="submit" variant="primary" disabled={setup.isPending}>{t(setup.isPending ? "auth.saving" : "auth.openDashboard")}</Button></div></form>
  </div></div>;
}
