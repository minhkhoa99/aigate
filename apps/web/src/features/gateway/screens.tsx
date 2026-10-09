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
  useSetRequireApiKey, type ApiKey, type ChatReadiness, type Combo, type ComboStrategy, type CreatedApiKey,
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

const STRATEGY_LABEL: Record<ComboStrategy, MessageKey> = { fallback: "comboList.fallback", "round-robin": "comboList.roundRobin", fusion: "comboList.fusion" };

// docs/contracts/combos.md: the saved combos and the round-robin rotation setting.
function CombosTab() {
  const { language, t } = useLocale();
  const combos = useCombos();
  const deleteCombo = useDeleteCombo();
  const stickyLimit = useComboStickyLimit();
  const setStickyLimit = useSetComboStickyLimit();
  const [removing, setRemoving] = useState<Combo | null>(null);
  const showToast = useToast();
  const fail = (error: unknown) => showToast({ tone: "error", error });
  const copyName = (name: string) => navigator.clipboard.writeText(name).then(
    () => showToast({ tone: "success", localized: { key: "comboList.copied", params: { name } } }),
    () => showToast({ tone: "error", localized: { key: "comboList.copyFailed" } }),
  );
  const saveStickyLimit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("stickyLimit"));
    setStickyLimit.mutate(value, {
      onSuccess: () => showToast({ tone: "success", localized: { key: "comboList.rotationSaved", params: { count: value } } }),
      onError: fail,
    });
  };

  return <div className="stack section-gap">
    <Panel title={t("comboList.title")} detail={t("comboList.detail")} className="panel-flush" action={<Link to="/gateway/routing/new" className="button button-primary">+ {t("comboList.create")}</Link>}>
      {combos.isPending ? <StateBlock state="loading" />
        : combos.isError ? <><StateBlock state="error" code={toProblem(combos.error, language).code} action={<Button onClick={() => void combos.refetch()}>{t("common.retry")}</Button>} /><Warning>{toProblem(combos.error, language).message}</Warning></>
        : combos.data.length === 0 ? <div className="state-block"><strong>{t("comboList.empty")}</strong><p>{t("comboList.emptyHint")}</p><Link to="/gateway/routing/new" className="button button-primary">{t("comboList.create")}</Link></div>
        : <Table columns={[t("comboList.name"), t("comboList.strategy"), t("comboList.members"), t("comboList.actions")]} rows={combos.data.map((combo) => [
          <code>{combo.name}</code>,
          <Pill tone={combo.strategy === "fusion" ? "info" : "muted"}>{t(STRATEGY_LABEL[combo.strategy])}</Pill>,
          <span className="mono">{combo.models.slice(0, 3).join(combo.strategy === "fusion" ? " + " : " → ")}{combo.models.length > 3 ? ` ${t("comboList.more", { count: combo.models.length - 3 })}` : ""}{combo.strategy === "fusion" ? ` · ${t("comboList.judge", { model: combo.judgeModel ?? combo.models[0] })}` : ""}</span>,
          <><Button variant="ghost" onClick={() => void copyName(combo.name)}>{t("comboList.copyName")}</Button>
            <a className="button button-ghost" href={`/gateway/routing/new?combo=${encodeURIComponent(combo.id)}`}>{t("comboList.edit")}</a>
            <Button variant="ghost" onClick={() => setRemoving(combo)}>{t("comboList.delete")}</Button></>,
        ])} />}
    </Panel>
    <Panel title={t("comboList.rotationTitle")} detail={t("comboList.rotationDetail")}>
      <form className="list-row" onSubmit={saveStickyLimit}>
        <div><strong>{t("comboList.rotationLabel")}</strong><small>{t("comboList.rotationHint")}</small></div>
        {stickyLimit.data === undefined ? <Pill>{stickyLimit.isError ? t("comboList.unavailable") : t("comboList.loading")}</Pill>
          : <><input key={stickyLimit.data} className="input" style={{ maxWidth: 96 }} name="stickyLimit" type="number" min={1} max={1000} step={1} required defaultValue={stickyLimit.data} aria-label={t("comboList.rotationLabel")} />
            <Button type="submit" disabled={setStickyLimit.isPending}>{setStickyLimit.isPending ? t("comboList.saving") : t("comboList.save")}</Button></>}
      </form>
      {stickyLimit.isError && <Warning>{toProblem(stickyLimit.error, language).code}: {toProblem(stickyLimit.error, language).message} <Button onClick={() => void stickyLimit.refetch()}>{t("common.retry")}</Button></Warning>}
    </Panel>
    {removing && <ConfirmDialog name={removing.name} detail={t("comboList.deleteHint")} onClose={() => setRemoving(null)} onConfirm={() => deleteCombo.mutate(removing.id, {
      onSuccess: () => { setRemoving(null); showToast({ tone: "success", localized: { key: "comboList.deleted", params: { name: removing.name } } }); },
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
