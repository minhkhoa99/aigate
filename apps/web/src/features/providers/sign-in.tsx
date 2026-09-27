import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { oauthAuthorize, oauthDeviceCode, oauthPoll, useOAuthExchange, type DeviceCode, type OAuthStart, type ProviderSummary } from "./api";

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
  return provider.signIn === "device_code" ? <DeviceSignIn provider={provider} onDone={onDone} /> : <BrowserSignIn provider={provider} onDone={onDone} />;
}

type Session = OAuthStart & { meta: Record<string, string> };

function BrowserSignIn({ provider, onDone }: { provider: ProviderSummary; onDone: () => void }) {
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
  const elsewhere = session !== null && !session.redirectUri.startsWith(`${window.location.origin}/`);

  const finish = (current: Session, data: CallbackData) => {
    if (handled.current) return;
    if (data.error) { setProblem(`${provider.name} returned an error: ${data.errorDescription ?? data.error}`); return; }
    const code = data.code ?? data.token;
    if (!code) { setProblem("The callback had no code. Paste the full address of the page the sign-in ended on."); return; }
    handled.current = true;
    exchange.mutate({ provider: provider.id, code, redirectUri: current.redirectUri, codeVerifier: current.codeVerifier, state: data.state ?? current.state, meta: current.meta }, {
      onSuccess: () => { showToast({ tone: "success", message: `Signed in to ${provider.name}.` }); onDone(); },
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
    const form = new FormData(event.currentTarget);
    const meta = needsApp ? Object.fromEntries(["baseUrl", "clientId", "clientSecret"].flatMap((name) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? [[name, value.trim()]] : [];
    })) : {};
    setStarting(true);
    setProblem(null);
    handled.current = false;
    oauthAuthorize(provider.id, `${window.location.origin}/callback`, meta)
      .then((start) => {
        setSession({ ...start, meta });
        if (start.authUrl) window.open(start.authUrl, OAUTH_CHANNEL, "popup,width=600,height=720");
      })
      .catch((error: unknown) => showToast({ tone: "error", ...toProblem(error) }))
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
        <Field label="GitLab URL" hint="Empty means https://gitlab.com."><Input name="baseUrl" maxLength={2048} placeholder="https://gitlab.com" /></Field>
        <Field label="Application ID" hint="From your GitLab OAuth application (scopes: api, read_user)."><Input name="clientId" required maxLength={256} /></Field>
        <Field label="Application secret" hint="Optional for a public application."><Input name="clientSecret" type="password" maxLength={512} autoComplete="off" /></Field>
      </>}
      <Button type="submit" variant="primary" disabled={starting || exchange.isPending}>{starting ? "Opening…" : session ? `Sign in to ${provider.name} again` : `Sign in with ${provider.name}`}</Button>
    </form>
    {session && <form onSubmit={submitPasted} className="stack">
      <p className="muted">{elsewhere
        ? <>{provider.name} returns to <code>{session.redirectUri}</code>, which this dashboard cannot receive. After you sign in, the window shows a page that cannot load: copy its full address and paste it here.</>
        : "Finish in the window that opened. If it does not come back here (for example on a remote dashboard), paste the address of the page it ended on, or the code it shows."}</p>
      <Field label="Callback URL or code"><Input name="callback" maxLength={8192} autoComplete="off" placeholder={`${session.redirectUri}?code=…`} /></Field>
      <Button type="submit" disabled={exchange.isPending}>{exchange.isPending ? "Signing in…" : "Finish sign-in"}</Button>
    </form>}
    {problem && <Warning tone="danger">{problem}</Warning>}
  </div>;
}

function DeviceSignIn({ provider, onDone }: { provider: ProviderSummary; onDone: () => void }) {
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
      if (Date.now() > deadline) { setProblem("The code expired before it was approved. Get a new code."); return; }
      try {
        const answer = await oauthPoll(provider.id, device.device_code);
        if (stopped) return;
        if (answer.success) {
          await client.invalidateQueries({ queryKey: ["connections"], exact: true });
          showToast({ tone: "success", message: `Signed in to ${provider.name}.` });
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
    oauthDeviceCode(provider.id)
      .then((code) => { setDevice(code); window.open(code.verification_uri_complete, "_blank", "noopener"); })
      .catch((error: unknown) => showToast({ tone: "error", ...toProblem(error) }))
      .finally(() => setStarting(false));
  };

  return <div className="stack">
    <Button variant="primary" onClick={begin} disabled={starting}>{starting ? "Requesting…" : device ? "Get a new code" : `Sign in with ${provider.name}`}</Button>
    {device && <div className="state-block"><strong>Code <code>{device.user_code}</code></strong>
      <p>Approve it at <a href={device.verification_uri_complete} target="_blank" rel="noreferrer">{device.verification_uri_complete}</a>. This window finishes by itself once it is approved.</p></div>}
    {problem && <Warning tone="danger">{problem}</Warning>}
  </div>;
}
