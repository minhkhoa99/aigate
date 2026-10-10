import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { cursorAutoImport, kiroApiKeyImport, kiroAutoImport, kiroCliProxyImport, kiroImport, oauthAuthorize, oauthDeviceCode, oauthPoll, traeExchange, traePoll, traeStart, traeStop, useCursorImport, useOAuthExchange, type DeviceCode, type KiroImportHint, type OAuthStart, type ProviderSummary, type TraeStart } from "./api";

// docs/contracts/oauth.md (oauth.dashboard-flow, kept from 9router): the provider's page opens in a popup and returns to
// /callback, which hands the code back to this window; a remote dashboard pastes the callback URL instead. A device
// code is shown and polled until it is approved or expires.
export const OAUTH_CHANNEL = "aigate-oauth";

export interface CallbackData { code?: string; token?: string; state?: string; error?: string; errorDescription?: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const field = (value: Record<string, unknown>, name: string): string | undefined => {
  const item = value[name];
  return typeof item === "string" && item ? item : undefined;
};

// A pasted callback URL, or the code itself.
function pasted(raw: string): CallbackData {
  const value = raw.trim();
  try {
    const query = new URL(value).searchParams;
    return { code: query.get("code") ?? undefined, token: query.get("token") ?? undefined, state: query.get("state") ?? undefined, error: query.get("error") ?? undefined };
  } catch {
    return value ? { code: value } : {};
  }
}

export function SignIn({ provider, onDone }: { provider: ProviderSummary; onDone: () => void }) {
  if (provider.signIn === "browser_token" && provider.id === "cursor") return <CursorSignIn onDone={onDone} />;
  if (provider.id === "kiro") return <KiroSignIn provider={provider} onDone={onDone} />;
  if (provider.id === "trae") return <TraeSignIn onDone={onDone} />;
  return provider.signIn === "device_code" ? <DeviceSignIn provider={provider} onDone={onDone} /> : <BrowserSignIn provider={provider} onDone={onDone} />;
}

function TraeSignIn({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const client = useQueryClient(); const showToast = useToast();
  const [session, setSession] = useState<TraeStart | null>(null); const [callback, setCallback] = useState("");
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState<string | null>(null);
  const done = useRef(onDone); done.current = onDone;

  useEffect(() => {
    if (!session) return undefined;
    let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const result = await traePoll(session.state);
        if (stopped) return;
        if (result.status === "done") {
          await client.invalidateQueries({ queryKey: ["connections"], exact: true });
           showToast({ tone: "success", message: t("providers.traeSignedIn") }); done.current(); return;
        }
         if (result.status === "error" || result.status === "unknown") { setProblem(result.error ?? t("providers.traeEnded")); setSession(null); return; }
        timer = setTimeout(() => void poll(), 1500);
      } catch (error) {
        if (!stopped) { showToast({ tone: "error", ...toProblem(error) }); timer = setTimeout(() => void poll(), 3000); }
      }
    };
    timer = setTimeout(() => void poll(), 1500);
    return () => { stopped = true; clearTimeout(timer); void traeStop().catch(() => undefined); };
  }, [session, client, showToast]);

  const begin = async () => {
    const popup = window.open("about:blank", OAUTH_CHANNEL, "popup,width=600,height=720");
     if (!popup) { setProblem(t("providers.allowPopups")); return; }
    setBusy(true); setProblem(null);
    try { const next = await traeStart(); setSession(next); popup.location.assign(next.authUrl); }
    catch (error) { popup.close(); showToast({ tone: "error", ...toProblem(error) }); }
    finally { setBusy(false); }
  };
  const importToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setProblem(null);
     try { await traeExchange(callback.trim()); await client.invalidateQueries({ queryKey: ["connections"], exact: true }); showToast({ tone: "success", message: t("providers.traeSignedIn") }); done.current(); }
    catch (error) { const issue = toProblem(error); setProblem(issue.message); }
    finally { setBusy(false); }
  };

  return <div className="stack">
     <p className="muted">{t("providers.callbackTokenHint")}</p>
     <Button type="button" variant="primary" onClick={() => void begin()} disabled={busy || !!session}>{busy ? t("providers.opening") : session ? t("providers.waitingCallback") : t("providers.signInTrae")}</Button>
     {session && <p className="muted">{t("providers.callbackReachHint")} <code>{session.callbackUrl}</code>{t("providers.callbackPasteHint")}</p>}
    <form onSubmit={importToken} className="stack">
       <Field label={t("providers.callbackField")}><textarea className="input" value={callback} onChange={(event) => setCallback(event.target.value)} rows={4} maxLength={8192} autoComplete="off" /></Field>
       <Button type="submit" disabled={busy || !callback.trim()}>{busy ? t("providers.importing") : t("providers.importCallback")}</Button>
    </form>
    {problem && <Warning tone="danger">{problem}</Warning>}
  </div>;
}

function CursorSignIn({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const importToken = useCursorImport();
  const showToast = useToast();
  const [accessToken, setAccessToken] = useState("");
  const [machineId, setMachineId] = useState("");
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const detect = () => {
    setChecking(true); setNotice(null);
    cursorAutoImport().then((result) => {
       if (result.found && result.accessToken && result.machineId) { setAccessToken(result.accessToken); setMachineId(result.machineId); setNotice(t("providers.cursorFound")); }
       else setNotice(result.error ?? t("providers.cursorNotFound"));
    }).catch((error: unknown) => showToast({ tone: "error", ...toProblem(error) })).finally(() => setChecking(false));
  };
  useEffect(() => { detect(); }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    importToken.mutate({ accessToken: accessToken.trim(), machineId: machineId.trim() }, {
       onSuccess: () => { showToast({ tone: "success", message: t("providers.importedCursor") }); onDone(); },
      onError: (error) => showToast({ tone: "error", ...toProblem(error) }),
    });
  };
  return <form onSubmit={submit} className="stack">
     <p className="muted">{t("providers.cursorRead")}</p>
     {checking ? <p className="muted">{t("providers.readingCursor")}</p> : <>{notice && <Warning tone="warning">{notice}</Warning>}<Button type="button" onClick={detect}>{t("providers.retryDetect")}</Button></>}
     <Field label={t("providers.accessToken")} hint={t("providers.cursorTokenHint")}><textarea className="input" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} rows={3} maxLength={4096} autoComplete="off" /></Field>
     <Field label={t("providers.machineId")} hint={t("providers.cursorMachineHint")}><input className="input" value={machineId} onChange={(event) => setMachineId(event.target.value)} maxLength={256} /></Field>
     <Button type="submit" variant="primary" disabled={checking || importToken.isPending || !accessToken.trim() || !machineId.trim()}>{importToken.isPending ? t("providers.importing") : t("providers.importToken")}</Button>
  </form>;
}

type Session = OAuthStart & { meta: Record<string, string> };

function BrowserSignIn({ provider, onDone, metaOverride = {} }: { provider: ProviderSummary; onDone: () => void; metaOverride?: Record<string, string> }) {
  const { t } = useLocale();
  const exchange = useOAuthExchange();
  const showToast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // postMessage and the channel can both deliver one callback; only the first is exchanged.
  const handled = useRef(false);
  // provider.gitlab-duo-oauth: GitLab signs in with the operator's own OAuth application.
  const needsApp = provider.id === "gitlab";
  // provider.codex-oauth: a provider that returns only to its CLI's address (codex: localhost:1455) cannot reach /callback.
  // When AIGate relays that address to /callback, the window finishes by itself and the paste is only the fallback.
  const elsewhere = session !== null && !session.relayed && (provider.id === "kiro" || !session.redirectUri.startsWith(`${window.location.origin}/`));

  const finish = (current: Session, data: CallbackData) => {
    if (handled.current) return;
     if (data.error) { setProblem(`${provider.name} returned an error: ${data.errorDescription ?? data.error}`); return; }
    const code = data.code ?? data.token;
     if (!code) { setProblem(t("providers.callbackNoCode")); return; }
    handled.current = true;
    exchange.mutate({ provider: provider.id, code, redirectUri: current.redirectUri, codeVerifier: current.codeVerifier, state: data.state ?? current.state, meta: current.meta }, {
       onSuccess: () => { showToast({ tone: "success", message: t("providers.signedInProvider", { provider: provider.name }) }); onDone(); },
      onError: (error) => { handled.current = false; showToast({ tone: "error", ...toProblem(error) }); },
    });
  };
  // The listeners are set up once per session; they reach the latest finish through this ref.
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!session) return undefined;
    const receive = (data: unknown) => {
      if (!isRecord(data)) return;
      finishRef.current(session, { code: field(data, "code"), token: field(data, "token"), state: field(data, "state"), error: field(data, "error"), errorDescription: field(data, "errorDescription") });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && isRecord(event.data) && event.data.type === "oauth_callback") receive(event.data.data);
    };
    window.addEventListener("message", onMessage);
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    channel.onmessage = (event) => receive(event.data);
    return () => { window.removeEventListener("message", onMessage); channel.close(); };
  }, [session]);

  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const popup = window.open("about:blank", OAUTH_CHANNEL, "popup,width=600,height=720");
     if (!popup) { setProblem(t("providers.allowPopups")); return; }
    const form = new FormData(event.currentTarget);
    const formMeta = needsApp ? Object.fromEntries(["baseUrl", "clientId", "clientSecret"].flatMap((name) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? [[name, value.trim()]] : [];
    })) : {};
    const meta = { ...metaOverride, ...formMeta };
    setStarting(true);
    setProblem(null);
    handled.current = false;
    oauthAuthorize(provider.id, `${window.location.origin}/callback`, meta)
      .then((start) => {
        setSession({ ...start, meta });
        if (start.authUrl) popup.location.assign(start.authUrl);
        else popup.close();
      })
      .catch((error: unknown) => { popup.close(); showToast({ tone: "error", ...toProblem(error) }); })
      .finally(() => setStarting(false));
  };

  const submitPasted = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("callback");
    if (session) finish(session, pasted(typeof value === "string" ? value : ""));
  };

  return <div className="stack">
    <form onSubmit={begin} className="stack">
      {needsApp && <>
         <Field label={t("providers.gitlabUrl")} hint={t("providers.gitlabUrlHint")}><Input name="baseUrl" maxLength={2048} placeholder="https://gitlab.com" /></Field>
         <Field label={t("providers.applicationId")} hint={t("providers.applicationIdHint")}><Input name="clientId" required maxLength={256} /></Field>
         <Field label={t("providers.applicationSecret")} hint={t("providers.optionalPublicApp")}><Input name="clientSecret" type="password" maxLength={512} autoComplete="off" /></Field>
      </>}
       <Button type="submit" variant="primary" disabled={starting || exchange.isPending}>{starting ? t("providers.opening") : session ? t("providers.signInAgainProvider", { provider: provider.name }) : t("providers.signInWithProvider", { provider: provider.name })}</Button>
    </form>
    {session && <form onSubmit={submitPasted} className="stack">
       <p className="muted">{elsewhere
        ? provider.id === "kiro"
           ? <>{t("providers.kiroCallbackHint")} <code>kiro://</code>{t("providers.copyCallbackHint")}</>
           : <>{provider.name} returns to <code>{session.redirectUri}</code>, which this dashboard cannot receive. {t("providers.copyCallbackHint")}</>
        : session.relayed
           ? <>{t("providers.finishRelayed")} <code>{session.redirectUri}</code>{t("providers.finishRelayedHint")}</>
           : t("providers.finishWindowHint")}</p>
       <Field label={t("providers.callbackFieldShort")}><Input name="callback" maxLength={8192} autoComplete="off" placeholder={`${session.redirectUri}?code=…`} /></Field>
       <Button type="submit" disabled={exchange.isPending}>{exchange.isPending ? t("providers.signingIn") : t("providers.finishSignIn")}</Button>
    </form>}
    {problem && <Warning tone="danger">{problem}</Warning>}
  </div>;
}

function DeviceSignIn({ provider, onDone, meta = {} }: { provider: ProviderSummary; onDone: () => void; meta?: Record<string, string> }) {
  const { t } = useLocale();
  const client = useQueryClient();
  const showToast = useToast();
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Polls at the provider's interval until the code is approved, refused, or expired. As 9router's dialog: only
  // expired_token and access_denied stop it (other errors keep polling until the code expires), and slow_down adds 5 s
  // to the interval, at most 30 s.
  useEffect(() => {
    if (!device) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interval = device.interval;
    const deadline = Date.now() + device.expires_in * 1000;
    const tick = async () => {
      if (stopped) return;
       if (Date.now() > deadline) { setProblem(t("providers.codeExpired")); return; }
      try {
        const answer = await oauthPoll(provider.id, device.device_code, device.providerData);
        if (stopped) return;
        if (answer.success) {
          await client.invalidateQueries({ queryKey: ["connections"], exact: true });
           showToast({ tone: "success", message: t("providers.signedInProvider", { provider: provider.name }) });
          doneRef.current();
          return;
        }
       if (answer.error === "expired_token" || answer.error === "access_denied") { setProblem(`${provider.name} refused the sign-in: ${answer.errorDescription ?? answer.error}.`); return; }
        if (answer.error === "slow_down") interval = Math.min(interval + 5, 30);
      } catch (error) {
        if (!stopped) showToast({ tone: "error", ...toProblem(error) });
        return;
      }
      timer = setTimeout(() => void tick(), interval * 1000);
    };
    timer = setTimeout(() => void tick(), interval * 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [device, provider.id, provider.name, client, showToast]);

  const begin = () => {
    setStarting(true);
    setProblem(null);
    oauthDeviceCode(provider.id, meta)
      .then((code) => { setDevice(code); window.open(code.verification_uri_complete, "_blank", "noopener"); })
      .catch((error: unknown) => showToast({ tone: "error", ...toProblem(error) }))
      .finally(() => setStarting(false));
  };

  return <div className="stack">
     <Button variant="primary" onClick={begin} disabled={starting}>{starting ? t("providers.requesting") : device ? t("providers.newCode") : t("providers.signInWithProvider", { provider: provider.name })}</Button>
     {device && <div className="state-block"><strong>Code <code>{device.user_code}</code></strong>
       <p>{t("providers.approveAt", { url: device.verification_uri_complete })}</p></div>}
    {problem && <Warning tone="danger">{problem}</Warning>}
  </div>;
}

function KiroSignIn({ provider, onDone }: { provider: ProviderSummary; onDone: () => void }) {
  const { t } = useLocale();
  const client = useQueryClient();
  const showToast = useToast();
  const [method, setMethod] = useState<string | null>(null);
  const [region, setRegion] = useState("us-east-1");
  const [startUrl, setStartUrl] = useState("");
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [profileArn, setProfileArn] = useState("");
  const [cliJson, setCliJson] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (method !== "import") return;
    let active = true;
    kiroAutoImport().then((result: KiroImportHint) => {
      if (!active) return;
      if (result.found) {
        setToken(result.refreshToken ?? ""); setClientId(result.clientId ?? ""); setClientSecret(result.clientSecret ?? "");
        setRegion(result.region ?? "us-east-1"); setProfileArn(result.profileArn ?? "");
         setHint(t("providers.kiroTokenFound"));
       } else setHint(result.error ?? t("providers.kiroTokenMissing"));
    }).catch((error: unknown) => { if (active) showToast({ tone: "error", ...toProblem(error) }); });
    return () => { active = false; };
  }, [method, showToast]);

  const save = async (action: () => Promise<unknown>) => {
    setLoading(true);
    try {
      await action(); await client.invalidateQueries({ queryKey: ["connections"], exact: true });
       showToast({ tone: "success", message: t("providers.kiroSignedIn") }); onDone();
    } catch (error) { showToast({ tone: "error", ...toProblem(error) }); }
    finally { setLoading(false); }
  };

   if (method === "builder") return <div className="stack"><Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button><DeviceSignIn provider={provider} onDone={onDone} meta={{ authMethod: "builder-id" }} /></div>;
  if (method === "idc") return <div className="stack">
     <Field label={t("providers.idcStartUrl")}><input className="input" value={startUrl} onChange={(event) => setStartUrl(event.target.value)} placeholder="https://your-org.awsapps.com/start" maxLength={2048} /></Field>
     <Field label={t("providers.awsRegion")}><input className="input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={64} /></Field>
     <Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button>
    <DeviceSignIn provider={provider} onDone={onDone} meta={{ authMethod: "idc", startUrl: startUrl.trim(), region: region.trim() || "us-east-1" }} />
  </div>;
   if (method === "google" || method === "github") return <div className="stack"><Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button><BrowserSignIn provider={provider} onDone={onDone} metaOverride={{ socialProvider: method }} /></div>;
  if (method === "import") return <div className="stack">
     <Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button>
    {hint && <Warning tone="warning">{hint}</Warning>}
     <Field label={t("providers.refreshToken")}><textarea className="input" value={token} onChange={(event) => setToken(event.target.value)} rows={3} maxLength={8192} autoComplete="off" /></Field>
     <Field label={t("providers.clientIdOptional")}><input className="input" value={clientId} onChange={(event) => setClientId(event.target.value)} maxLength={512} autoComplete="off" /></Field>
     <Field label={t("providers.clientSecretOptional")}><input className="input" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} type="password" maxLength={1024} autoComplete="off" /></Field>
     <Field label={t("providers.awsRegion")}><input className="input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={64} /></Field>
     <Field label={t("providers.profileArn")}><input className="input" value={profileArn} onChange={(event) => setProfileArn(event.target.value)} maxLength={1024} autoComplete="off" /></Field>
     <Button type="button" variant="primary" disabled={loading || !token.trim()} onClick={() => void save(() => kiroImport({ refreshToken: token.trim(), ...(clientId && clientSecret ? { clientId, clientSecret, region } : {}), ...(profileArn ? { profileArn } : {}) }))}>{loading ? t("providers.importing") : t("providers.importRefresh")}</Button>
  </div>;
  if (method === "cli") return <div className="stack">
     <Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button>
     <Field label={t("providers.cliJson")}><textarea className="input" value={cliJson} onChange={(event) => setCliJson(event.target.value)} rows={8} maxLength={65536} autoComplete="off" /></Field>
     <Button type="button" variant="primary" disabled={loading || !cliJson.trim()} onClick={() => void save(() => kiroCliProxyImport(cliJson.trim()))}>{loading ? t("providers.importing") : t("providers.importJson")}</Button>
  </div>;
  if (method === "key") return <div className="stack">
     <Button type="button" onClick={() => setMethod(null)}>{t("providers.back")}</Button>
     <Field label={t("providers.kiroApiKey")}><textarea className="input" value={apiKey} onChange={(event) => setApiKey(event.target.value)} rows={3} maxLength={4096} autoComplete="off" /></Field>
     <Field label={t("providers.awsRegion")}><input className="input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={64} /></Field>
     <Button type="button" variant="primary" disabled={loading || !apiKey.trim()} onClick={() => void save(() => kiroApiKeyImport({ apiKey: apiKey.trim(), region: region.trim() || "us-east-1" }))}>{loading ? t("providers.validating") : t("providers.validateImportKey")}</Button>
  </div>;

   const options = [["builder", t("providers.awsBuilder")], ["idc", t("providers.awsIdc")], ["google", t("providers.googleAccount")], ["github", t("providers.githubAccount")], ["import", t("providers.importRefreshOption")], ["cli", t("providers.importCliJson")], ["key", t("providers.kiroApiKey")]];
   return <div className="stack"><p className="muted">{t("providers.chooseKiro")}</p>{options.map(([id, label]) => <Button key={id} type="button" onClick={() => setMethod(id)}>{label}</Button>)}</div>;
}
