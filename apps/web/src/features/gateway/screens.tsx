import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { Button, ConfirmDialog, CopyField, Dot, Field, Input, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { CapacityTab } from "./capacity-pools";
import {
  useApiKeys, useChatReadiness, useComboStickyLimit, useCombos, useCreateKey, useDeleteCombo, useDeleteKey, useRequireApiKey, useSetComboStickyLimit, useSetKeyActive,
  usePatchTokenSaverSettings, useTokenSaverSettings, usePxpipeStatus, useInstallPxpipe,
  useSetRequireApiKey, type ApiKey, type ChatReadiness, type Combo, type ComboStrategy, type CreatedApiKey, type GatewaySettings,
} from "./api";

const READINESS: Record<ChatReadiness, { tone: "healthy" | "warning"; label: string; hint?: string }> = {
  ready: { tone: "healthy", label: "Ready" },
  "no-connection": { tone: "warning", label: "Connect a provider", hint: "The chat API answers once a provider is connected." },
  "check-connection": { tone: "warning", label: "Check connection", hint: "A provider is connected, but its key has not passed a test yet." },
};
const SAMPLE_BODY = JSON.stringify({ model: "openai/gpt-4.1-mini", messages: [{ role: "user", content: "Hello" }] });
// docs/contracts/protocol-anthropic.md: the same models through the Anthropic Messages protocol.
const ANTHROPIC_BODY = JSON.stringify({ model: "openai/gpt-4.1-mini", max_tokens: 256, stream: false, messages: [{ role: "user", content: "Hello" }] });
// docs/contracts/protocol-responses.md: the same models through the OpenAI Responses protocol.
const RESPONSES_BODY = JSON.stringify({ model: "openai/gpt-4.1-mini", stream: false, input: "Hello" });
// docs/contracts/protocol-gemini.md: the same models through the Gemini generateContent protocol (text only).
const GEMINI_BODY = JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Hello" }] }] });

export function EndpointKeys() {
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);
  const keys = useApiKeys();
  const createKey = useCreateKey();
  const setActive = useSetKeyActive();
  const deleteKey = useDeleteKey();
  const requireApiKey = useRequireApiKey();
  const setRequireApiKey = useSetRequireApiKey();
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  // The chat API (docs/contracts/chat-lane.md) on this origin.
  const baseUrl = `${window.location.origin}/v1`;
  const readiness = useChatReadiness();
  const state = readiness.data ? READINESS[readiness.data] : undefined;
  const curl = `curl ${baseUrl}/chat/completions -H "Authorization: Bearer <your AIGate key>" -H "Content-Type: application/json" -d '${SAMPLE_BODY}'`;
  const anthropicCurl = `curl ${baseUrl}/messages -H "x-api-key: <your AIGate key>" -H "Content-Type: application/json" -d '${ANTHROPIC_BODY}'`;
  const responsesCurl = `curl ${baseUrl}/responses -H "Authorization: Bearer <your AIGate key>" -H "Content-Type: application/json" -d '${RESPONSES_BODY}'`;
  const geminiCurl = `curl ${window.location.origin}/v1beta/models/openai/gpt-4.1-mini:generateContent -H "Authorization: Bearer <your AIGate key>" -H "Content-Type: application/json" -d '${GEMINI_BODY}'`;
  const closeCreate = () => { setShowCreate(false); setCreated(null); createKey.reset(); };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    createKey.mutate(typeof name === "string" ? name : "", { onSuccess: setCreated, onError: fail });
  };

  return <>
    <PageHeading eyebrow="Gateway / Endpoint & Keys" title="Gateway endpoints" description="Configure your client base URL and manage access tokens." />
    <Panel title="Base URL" detail="Use this URL in OpenAI-compatible, Anthropic, and OpenAI Responses clients." action={state ? <Pill tone={state.tone}>{state.label}</Pill> : <Pill>{readiness.isError ? "Status unavailable" : "Checking…"}</Pill>}>
      {state?.hint && <Warning>{state.hint} <a href="/providers/connections">Open Connections</a></Warning>}
      <CopyField label="OpenAI compatible endpoint" value={baseUrl} />
      <div className="endpoint-examples"><span>OpenAI</span><span>Anthropic</span><span>Responses</span><span>Gemini</span></div>
      <p className="muted">OpenAI clients call <code>/v1/chat/completions</code>; Anthropic clients (Claude Code, the Anthropic SDK) call <code>/v1/messages</code> with the key in <code>x-api-key</code>; Responses clients (Codex CLI, the OpenAI SDK) call <code>/v1/responses</code>, also reachable as <code>/responses</code> and <code>/codex/…</code>. Gemini clients call <code>/v1beta/models/provider/model:generateContent</code> (or <code>:streamGenerateContent</code>) with <code>Authorization: Bearer</code>; only text reaches the model, and <code>x-goog-api-key</code> is read only for audio (TTS) requests, which go to Google through your Gemini connection. List models at <code>/v1/models</code>, or send <code>provider/model</code> such as <code>openai/gpt-4.1-mini</code>.</p>
      <CopyField label="Terminal example" value={`export OPENAI_BASE_URL=${baseUrl}`} />
      <CopyField label="Test request" value={curl} />
      <CopyField label="Claude Code" value={`export ANTHROPIC_BASE_URL=${window.location.origin} ANTHROPIC_API_KEY=<your AIGate key>`} />
      <CopyField label="Anthropic test request" value={anthropicCurl} />
      <CopyField label="Codex CLI" value={`OPENAI_BASE_URL=${baseUrl} OPENAI_API_KEY=<your AIGate key> codex -m openai/gpt-4.1-mini`} />
      <CopyField label="Responses test request" value={responsesCurl} />
      <CopyField label="Gemini test request" value={geminiCurl} />
    </Panel>
    <Panel title="API keys" detail="Manage scoped gateway tokens for upstream client authentication." className="section-gap panel-flush" action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create key</Button>}>
      {keys.isPending ? <StateBlock state="loading" />
        : keys.isError ? <StateBlock state="error" code={toProblem(keys.error).code} action={<Button onClick={() => void keys.refetch()}>Retry</Button>} />
        : <Table empty="No API keys yet. Create one for each client." columns={["Name", "Masked key", "Created", "Status", "Actions"]} rows={keys.data.map((key) => [
          key.name, <code>{key.maskedKey}</code>, new Date(key.createdAt).toLocaleDateString(),
          <Pill tone={key.isActive ? "healthy" : "muted"}>{key.isActive ? "Active" : "Disabled"}</Pill>,
          <><Button variant="ghost" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: key.id, isActive: !key.isActive }, { onError: fail })}>{key.isActive ? "Disable" : "Enable"}</Button>
            <Button variant="ghost" onClick={() => setRevoke(key)}>Revoke</Button></>,
        ])} />}
    </Panel>
    <Panel title="Security settings" detail="Protect this gateway from requests without a valid key." className="section-gap">
      <div className="list-row"><div><strong>Require API key</strong><small>Requests without a valid key are rejected. When off, only this machine can call the chat API.</small></div><input type="checkbox" checked={requireApiKey.data ?? true} disabled={requireApiKey.data === undefined || setRequireApiKey.isPending} onChange={(e) => setRequireApiKey.mutate(e.target.checked, { onError: fail })} aria-label="Require API key" /></div>
    </Panel>
    {showCreate && <Modal title="Create API key" onClose={closeCreate}>
      {created ? <><Warning>Copy this key now. It is shown only once and cannot be recovered.</Warning><CopyField label={created.name} value={created.key} /><div className="modal-actions"><Button variant="primary" onClick={closeCreate}>Done</Button></div></>
        : <form onSubmit={submitCreate}><p>Give this key a name. Its value will be shown once after issuance.</p><Field label="Name"><Input name="name" required maxLength={64} placeholder="e.g. Local development" /></Field><div className="modal-actions"><Button onClick={closeCreate}>Cancel</Button><Button type="submit" variant="primary" disabled={createKey.isPending}>{createKey.isPending ? "Creating…" : "Create key"}</Button></div></form>}
    </Modal>}
    {revoke && <ConfirmDialog name={revoke.name} onClose={() => setRevoke(null)} onConfirm={() => deleteKey.mutate(revoke.id, {
      onSuccess: () => { setRevoke(null); showToast({ tone: "success", message: `Revoked ${revoke.name}.` }); },
      onError: (error) => { setRevoke(null); fail(error); },
    })} />}
  </>;
}

const STRATEGY_LABEL: Record<ComboStrategy, string> = { fallback: "Fallback", "round-robin": "Round robin", fusion: "Fusion" };

// docs/contracts/combos.md: the saved combos and the round-robin rotation setting.
function CombosTab() {
  const combos = useCombos();
  const deleteCombo = useDeleteCombo();
  const stickyLimit = useComboStickyLimit();
  const setStickyLimit = useSetComboStickyLimit();
  const [removing, setRemoving] = useState<Combo | null>(null);
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const copyName = (name: string) => navigator.clipboard.writeText(name).then(
    () => showToast({ tone: "success", message: `Copied ${name}.` }),
    () => showToast({ tone: "error", message: "The browser did not allow copying. Select the name and copy it." }),
  );
  const saveStickyLimit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("stickyLimit"));
    setStickyLimit.mutate(value, {
      onSuccess: () => showToast({ tone: "success", message: `Round-robin combos now move to the next member after ${value} request${value === 1 ? "" : "s"}.` }),
      onError: fail,
    });
  };

  return <div className="stack section-gap">
    <Panel title="Combos" detail="Clients send a combo's name as the model; GET /v1/models lists combos first." className="panel-flush" action={<Link to="/gateway/routing/new" className="button button-primary">+ Create combo</Link>}>
      {combos.isPending ? <StateBlock state="loading" />
        : combos.isError ? <StateBlock state="error" code={toProblem(combos.error).code} action={<Button onClick={() => void combos.refetch()}>Retry</Button>} />
        : combos.data.length === 0 ? <div className="state-block"><strong>No combos yet</strong><p>Group models under one name, then choose fallback, round robin, or fusion.</p><Link to="/gateway/routing/new" className="button button-primary">Create combo</Link></div>
        : <Table columns={["Name", "Strategy", "Members", "Actions"]} rows={combos.data.map((combo) => [
          <code>{combo.name}</code>,
          <Pill tone={combo.strategy === "fusion" ? "info" : "muted"}>{STRATEGY_LABEL[combo.strategy]}</Pill>,
          <span className="mono">{combo.models.slice(0, 3).join(combo.strategy === "fusion" ? " + " : " → ")}{combo.models.length > 3 ? ` +${combo.models.length - 3} more` : ""}{combo.strategy === "fusion" ? ` · judge ${combo.judgeModel ?? combo.models[0]}` : ""}</span>,
          <><Button variant="ghost" onClick={() => void copyName(combo.name)}>Copy name</Button>
            <a className="button button-ghost" href={`/gateway/routing/new?combo=${encodeURIComponent(combo.id)}`}>Edit</a>
            <Button variant="ghost" onClick={() => setRemoving(combo)}>Delete</Button></>,
        ])} />}
    </Panel>
    <Panel title="Round-robin rotation" detail="Applies to every round-robin combo. The other members stay in the fallback chain.">
      <form className="list-row" onSubmit={saveStickyLimit}>
        <div><strong>Requests per member before rotating</strong><small>1 moves to the next member on every request; up to 1000.</small></div>
        {stickyLimit.data === undefined ? <Pill>{stickyLimit.isError ? "Unavailable" : "Loading…"}</Pill>
          : <><input key={stickyLimit.data} className="input" style={{ maxWidth: 96 }} name="stickyLimit" type="number" min={1} max={1000} step={1} required defaultValue={stickyLimit.data} aria-label="Requests per member before rotating" />
            <Button type="submit" disabled={setStickyLimit.isPending}>{setStickyLimit.isPending ? "Saving…" : "Save"}</Button></>}
      </form>
    </Panel>
    {removing && <ConfirmDialog name={removing.name} detail="Clients that send this name as the model will no longer reach its members." onClose={() => setRemoving(null)} onConfirm={() => deleteCombo.mutate(removing.id, {
      onSuccess: () => { setRemoving(null); showToast({ tone: "success", message: `Deleted ${removing.name}.` }); },
      onError: (error) => { setRemoving(null); fail(error); },
    })} />}
  </div>;
}

export function Routing() {
  const [tab, setTab] = useState("Combo");
  return <>
    <PageHeading eyebrow="Gateway / Routing" title="Routing & fallback" description="Decide where traffic goes, when to retry, and how to recover from failure." action={<Link to="/gateway/routing/new" className="button button-primary">+ Create combo</Link>} />
    <Tabs items={["Combo", "Overview", "Fallback", "Capacity adapter", "Simulator"]} active={tab} onChange={setTab} />
    {tab === "Combo" && <CombosTab />}
    {tab === "Capacity adapter" && <CapacityTab />}
    {tab !== "Combo" && tab !== "Capacity adapter" && <div className="section-gap"><Warning>Preview with sample data: this tab is not connected to the gateway yet. Account fallback runs as described; choose its strategy in Settings → Auth & Access.</Warning></div>}
    {tab === "Overview" && <div className="grid grid-2 section-gap"><Panel title="Active routes" detail="Current model resolution order">
      {["claude-3.5-sonnet → Anthropic primary", "gpt-4o → OpenAI primary", "gemini-2.5-pro → Google Vertex", "deepseek-r1 → DeepSeek pooled"].map((r, i) => <div className="list-row" key={r}><Dot tone={i === 3 ? "warning" : "healthy"} /><div><strong className="mono">{r}</strong><small>{i === 3 ? "Fallback available" : "Direct · healthy"}</small></div><Pill tone={i === 3 ? "warning" : "healthy"}>{i === 3 ? "Guarded" : "Active"}</Pill></div>)}
    </Panel><Panel title="Decision path" detail="Single request, from client to provider"><div className="flow-steps">{["Validate API key", "Resolve alias & capability", "Choose connection", "Translate request", "Dispatch with timeout", "Stream response"].map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, "0")}</span><strong>{s}</strong><Dot /></div>)}</div></Panel></div>}
    {tab === "Fallback" && <div className="stack section-gap"><Warning>Request-caused errors return directly to the client. Account fallback is reserved for recoverable provider failures.</Warning><Panel title="Fallback policy" detail="The first healthy route that can serve the request wins."><Table columns={["Condition", "Action", "Lock", "Status"]} rows={[
      ["Invalid request · 400", "Return to client", "None", <Pill tone="healthy">Terminal</Pill>],
      ["Rate limit · 429", "Next account", "Exponential", <Pill tone="warning">Fallback</Pill>],
      ["Provider outage · 503", "Retry, then next route", "30 seconds", <Pill tone="warning">Fallback</Pill>],
      ["Client abort · 499", "Cancel upstream", "None", <Pill tone="healthy">Terminal</Pill>],
    ]} /></Panel></div>}
    {tab === "Simulator" && <div className="split section-gap"><Panel title="Test a route" detail="Preview decisions without sending a provider request"><div className="stack"><Field label="Model"><Input defaultValue="claude-3.5-sonnet" /></Field><Field label="Input tokens"><Input type="number" defaultValue="2048" /></Field><Button variant="primary">Run simulation</Button></div></Panel><Panel title="Expected route"><div className="flow-steps"><div><span>01</span><strong>Anthropic primary</strong><Pill tone="healthy">Selected</Pill></div><div><span>02</span><strong>Anthropic secondary</strong><Pill>Standby</Pill></div></div></Panel></div>}
  </>;
}

export function TokenSaver() {
  const query = useTokenSaverSettings();
  const pxpipe = usePxpipeStatus();
  const installPxpipe = useInstallPxpipe();
  const save = usePatchTokenSaverSettings();
  const showToast = useToast();
  const [headroomUrl, setHeadroomUrl] = useState("");
  if (query.isPending) return <StateBlock state="loading" />;
  if (query.isError || !query.data) return <StateBlock state="error" code={toProblem(query.error).code} action={<Button onClick={() => void query.refetch()}>Retry</Button>} />;
  const config = query.data;
  const pxpipeReady = pxpipe.data?.installed === true && pxpipe.data.loaded;
  const patch = (fields: Partial<GatewaySettings>) => save.mutate(fields, { onError: (error) => showToast({ tone: "error", ...toProblem(error) }) });
  const toggle = (label: string, description: string, checked: boolean, field: string, disabled = false) =>
    <div className="list-row" key={field}><div><strong>{label}</strong><small>{description}</small></div><input type="checkbox" checked={checked} disabled={disabled || save.isPending} aria-label={`Enable ${label}`} onChange={(event) => patch({ [field]: event.target.checked })} /></div>;
  const stage = (name: string, enabled: boolean) => <div key={name}><span>{String(["RTK", "Headroom", "Caveman", "Ponytail", "PXPIPE"].indexOf(name) + 1).padStart(2, "0")}</span><strong>{name}</strong><Pill tone={enabled ? "healthy" : "muted"}>{enabled ? "Enabled" : "Off"}</Pill></div>;
  return <>
    <PageHeading eyebrow="Gateway / Token Saver" title="Token Saver" description="Compression may reduce input tokens; style prompts add some, so net savings depend on the request and provider." action={<Pill tone={config.tokenSaverEnabled ? "healthy" : "warning"}>{config.tokenSaverEnabled ? "Enabled" : "Disabled"}</Pill>} />
    <Panel title="Master switch" detail="Send x-aigate-token-saver: off to bypass every Token Saver stage for one request.">
      {toggle("Enable Token Saver", "Apply enabled stages before provider dispatch.", config.tokenSaverEnabled, "tokenSaverEnabled")}
    </Panel>
    <Panel title="Optimization pipeline" detail="Stages run in this order. Optional services fail open." className="section-gap"><div className="pipeline">
      {stage("RTK", config.tokenSaverEnabled && config.rtkEnabled)}{stage("Headroom", config.tokenSaverEnabled && config.headroomEnabled)}
      {stage("Caveman", config.tokenSaverEnabled && config.cavemanEnabled)}{stage("Ponytail", config.tokenSaverEnabled && config.ponytailEnabled)}
      {stage("PXPIPE", config.tokenSaverEnabled && config.pxpipeEnabled && pxpipeReady)}
    </div></Panel>
    <Panel title="Stage controls" className="section-gap">
      {toggle("RTK · tool output compression", "Removes consecutive duplicate lines from large, non-error tool results.", config.rtkEnabled, "rtkEnabled", !config.tokenSaverEnabled)}
      {toggle("Headroom · context compression", "Sends plain-text conversations to the configured local or remote Headroom endpoint.", config.headroomEnabled, "headroomEnabled", !config.tokenSaverEnabled)}
      {config.headroomEnabled && <div className="list-row token-saver-url"><div><strong>Headroom URL</strong><small>POST /v1/compress; failures leave the request unchanged.</small></div><input className="input" type="url" aria-label="Headroom URL" value={headroomUrl || config.headroomUrl} onChange={(event) => setHeadroomUrl(event.target.value)} onBlur={() => { if (headroomUrl && headroomUrl !== config.headroomUrl) { patch({ headroomUrl }); setHeadroomUrl(""); } }} /></div>}
      {config.headroomEnabled && toggle("Compress user messages", "Off by default; when on, Headroom may rewrite user-provided text too.", config.headroomCompressUserMessages, "headroomCompressUserMessages")}
      {toggle("Caveman · concise response style", "Adds an instruction (and input tokens); shorter output is not guaranteed.", config.cavemanEnabled, "cavemanEnabled", !config.tokenSaverEnabled)}
      {config.cavemanEnabled && <div className="list-row"><strong>Caveman level</strong><select className="input" aria-label="Caveman level" value={config.cavemanLevel} onChange={(event) => { const level = event.target.value; if (level === "lite" || level === "full" || level === "ultra") patch({ cavemanLevel: level }); }}>{["lite", "full", "ultra"].map((level) => <option key={level}>{level}</option>)}</select></div>}
      {toggle("Ponytail · minimal coding style", "Adds coding instructions (and input tokens); shorter output is not guaranteed.", config.ponytailEnabled, "ponytailEnabled", !config.tokenSaverEnabled)}
      {config.ponytailEnabled && <div className="list-row"><strong>Ponytail level</strong><select className="input" aria-label="Ponytail level" value={config.ponytailLevel} onChange={(event) => { const level = event.target.value; if (level === "lite" || level === "full" || level === "ultra") patch({ ponytailLevel: level }); }}>{["lite", "full", "ultra"].map((level) => <option key={level}>{level}</option>)}</select></div>}
      <div className="list-row"><div><strong>PXPIPE · image block extraction</strong><small>{pxpipeReady ? "Installed" + (pxpipe.data?.version ? " · v" + pxpipe.data.version : "") + "; transforms eligible Anthropic requests in-process." : "Install pxpipe-proxy into AIGate's data directory. It is used only for Anthropic Messages requests."}</small></div>
        {!pxpipeReady ? <Button disabled={installPxpipe.isPending || pxpipe.data?.installing} onClick={() => installPxpipe.mutate(undefined, { onError: (error) => showToast({ tone: "error", ...toProblem(error) }) })}>{installPxpipe.isPending ? "Installing…" : "Install PXPIPE"}</Button> : <input type="checkbox" checked={config.pxpipeEnabled} disabled={!config.tokenSaverEnabled || save.isPending} aria-label="Enable PXPIPE image block extraction" onChange={(event) => patch({ pxpipeEnabled: event.target.checked })} />}
      </div>
    </Panel>
  </>;
}
