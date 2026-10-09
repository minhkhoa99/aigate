import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { Button, ConfirmDialog, CopyField, Field, Input, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { CapacityTab } from "./capacity-pools";
import { RoutingSimulatorTab } from "./routing-simulator";
import { RoutingStatusTab } from "./routing-status";
import { clientProtocols, endpointSetup, type ClientProtocol } from "./endpoint-variants";
import type { MessageKey } from "../../shared/i18n";
import {
  useApiKeys, useChatReadiness, useComboStickyLimit, useCombos, useCreateKey, useDeleteCombo, useDeleteKey, useRequireApiKey, useSetComboStickyLimit, useSetKeyActive,
  usePatchTokenSaverSettings, useTokenSaverSettings, usePxpipeStatus, useInstallPxpipe,
  useSetRequireApiKey, type ApiKey, type ChatReadiness, type Combo, type ComboStrategy, type CreatedApiKey, type GatewaySettings,
} from "./api";

const READINESS: Record<ChatReadiness, { tone: "healthy" | "warning"; label: MessageKey; hint?: MessageKey }> = {
  ready: { tone: "healthy", label: "endpoint.ready" },
  "no-connection": { tone: "warning", label: "endpoint.connectProvider", hint: "endpoint.noConnectionHint" },
  "check-connection": { tone: "warning", label: "endpoint.checkConnection", hint: "endpoint.checkConnectionHint" },
};
const PROTOCOL_LABELS: Record<ClientProtocol, MessageKey> = {
  openai: "endpoint.protocolOpenai", anthropic: "endpoint.protocolAnthropic",
  responses: "endpoint.protocolResponses", gemini: "endpoint.protocolGemini",
};
const PROTOCOL_NOTES: Record<ClientProtocol, MessageKey> = {
  openai: "endpoint.noteOpenai", anthropic: "endpoint.noteAnthropic",
  responses: "endpoint.noteResponses", gemini: "endpoint.noteGemini",
};

export function EndpointKeys() {
  const { language, t } = useLocale();
  const [protocol, setProtocol] = useState<ClientProtocol>("openai");
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
  const fail = (error: unknown) => showToast({ tone: "error", error });
  const readiness = useChatReadiness();
  const state = readiness.data ? READINESS[readiness.data] : undefined;
  const readinessProblem = readiness.isError ? toProblem(readiness.error, language) : null;
  const keysProblem = keys.isError ? toProblem(keys.error, language) : null;
  const settingsProblem = requireApiKey.isError ? toProblem(requireApiKey.error, language) : null;
  const setup = endpointSetup(window.location.origin, protocol);
  const date = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US");
  const closeCreate = () => { setShowCreate(false); setCreated(null); createKey.reset(); };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    createKey.mutate(typeof name === "string" ? name : "", { onSuccess: setCreated, onError: fail });
  };

  return <>
    <PageHeading eyebrow={t("endpoint.eyebrow")} title={t("endpoint.title")} description={t("endpoint.description")} />
    <Panel title={t("endpoint.baseTitle")} detail={t("endpoint.baseDetail")} action={state ? <Pill tone={state.tone}>{t(state.label)}</Pill> : <Pill>{t(readiness.isError ? "endpoint.statusUnavailable" : "endpoint.checking")}</Pill>}>
      {state?.hint && <Warning>{t(state.hint)} <a href="/providers/connections">{t("endpoint.openConnections")}</a></Warning>}
      {readinessProblem && <Warning tone="danger"><code>{readinessProblem.code}</code> · {readinessProblem.message} <Button onClick={() => void readiness.refetch()}>{t("common.retry")}</Button></Warning>}
      <nav className="endpoint-examples" aria-label={t("endpoint.protocolLabel")}>{clientProtocols.map(item =>
        <button key={item} type="button" aria-pressed={protocol === item} className={protocol === item ? "active" : ""} onClick={() => setProtocol(item)}>{t(PROTOCOL_LABELS[item])}</button>
      )}</nav>
      <p className="muted">{t(PROTOCOL_NOTES[protocol])}</p>
      <CopyField label={t(protocol === "gemini" ? "endpoint.requestUrl" : "endpoint.clientBaseUrl")} value={setup.displayUrl} />
      {setup.setup && <CopyField label={t("endpoint.posixSetup")} value={setup.setup} />}
      <CopyField label={t("endpoint.testRequest")} value={setup.testRequest} />
    </Panel>
    <Panel title={t("endpoint.keysTitle")} detail={t("endpoint.keysDetail")} className="section-gap panel-flush" action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ {t("endpoint.createKey")}</Button>}>
      {keys.isPending ? <StateBlock state="loading" />
        : keys.isError ? <><StateBlock state="error" code={keysProblem?.code} action={<Button onClick={() => void keys.refetch()}>{t("common.retry")}</Button>} /><Warning tone="danger">{keysProblem?.message}</Warning></>
        : <Table empty={t("endpoint.keysEmpty")} columns={[t("endpoint.name"), t("endpoint.maskedKey"), t("endpoint.created"), t("endpoint.status"), t("endpoint.actions")]} rows={keys.data.map((key) => [
          key.name, <code>{key.maskedKey}</code>, date.format(new Date(key.createdAt)),
          <Pill tone={key.isActive ? "healthy" : "muted"}>{t(key.isActive ? "endpoint.active" : "endpoint.disabled")}</Pill>,
          <><Button variant="ghost" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: key.id, isActive: !key.isActive }, { onError: fail })}>{t(key.isActive ? "endpoint.disable" : "endpoint.enable")}</Button>
            <Button variant="ghost" onClick={() => setRevoke(key)}>{t("endpoint.revoke")}</Button></>,
        ])} />}
    </Panel>
    <Panel title={t("endpoint.securityTitle")} detail={t("endpoint.securityDetail")} className="section-gap">
      <div className="list-row"><div><strong>{t("endpoint.requireKey")}</strong><small>{t("endpoint.requireKeyHint")}</small></div><input type="checkbox" checked={requireApiKey.data ?? true} disabled={requireApiKey.data === undefined || setRequireApiKey.isPending} onChange={(e) => setRequireApiKey.mutate(e.target.checked, { onError: fail })} aria-label={t("endpoint.requireKey")} /></div>
      {settingsProblem && <Warning tone="danger"><code>{settingsProblem.code}</code> · {settingsProblem.message} <Button onClick={() => void requireApiKey.refetch()}>{t("common.retry")}</Button></Warning>}
    </Panel>
    {showCreate && <Modal title={t("endpoint.createTitle")} onClose={closeCreate}>
      {created ? <><Warning>{t("endpoint.onceWarning")}</Warning><CopyField label={created.name} value={created.key} /><div className="modal-actions"><Button variant="primary" onClick={closeCreate}>{t("endpoint.done")}</Button></div></>
        : <form onSubmit={submitCreate}><p>{t("endpoint.namePrompt")}</p><Field label={t("endpoint.name")}><Input name="name" required maxLength={64} placeholder={t("endpoint.namePlaceholder")} /></Field><div className="modal-actions"><Button onClick={closeCreate}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={createKey.isPending}>{t(createKey.isPending ? "endpoint.creating" : "endpoint.createKey")}</Button></div></form>}
    </Modal>}
    {revoke && <ConfirmDialog name={revoke.name} onClose={() => setRevoke(null)} onConfirm={() => deleteKey.mutate(revoke.id, {
      onSuccess: () => { setRevoke(null); showToast({ tone: "success", localized: { key: "endpoint.revoked", params: { name: revoke.name } } }); },
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
  const { t } = useLocale();
  const labels: Record<string, string> = { Combo: t("routingStatus.tabCombo"), Overview: t("routingStatus.tabOverview"),
    Fallback: t("routingStatus.tabFallback"), "Capacity adapter": t("routingStatus.tabCapacity"), Simulator: t("routingStatus.tabSimulator") };
  return <>
    <PageHeading eyebrow={t("routingStatus.pageEyebrow")} title={t("routingStatus.pageTitle")} description={t("routingStatus.pageDescription")} action={<Link to="/gateway/routing/new" className="button button-primary">{t("routingStatus.createCombo")}</Link>} />
    <Tabs items={["Combo", "Overview", "Fallback", "Capacity adapter", "Simulator"]} active={tab} onChange={setTab} getLabel={item => labels[item]} />
    {tab === "Combo" && <CombosTab />}
    {tab === "Capacity adapter" && <CapacityTab />}
    {(tab === "Overview" || tab === "Fallback") && <RoutingStatusTab mode={tab === "Overview" ? "overview" : "fallback"} onSimulate={() => setTab("Simulator")} />}
    {tab === "Simulator" && <RoutingSimulatorTab />}
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
