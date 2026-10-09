import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import type { MessageKey } from "../../shared/i18n";
import { testModel, useCombos, useConnectedModels, useCreateCombo, useUpdateCombo, type Combo, type ComboFields, type ComboStrategy, type ModelProbe } from "./api";

// docs/contracts/combos.md: the server's bounds, shown so the form does not promise more.
const MAX_MEMBERS = 16;
const FUSION_PARALLEL = 4;

type Member = { id: number; model: string };
type Probe = "testing" | ModelProbe;

const modeDetails: Record<ComboStrategy, MessageKey> = {
  fallback: "comboForm.fallbackHint",
  "round-robin": "comboForm.roundRobinHint",
  fusion: "comboForm.fusionHint",
};
const modeLabels: Record<ComboStrategy, MessageKey> = { fallback: "comboList.fallback", "round-robin": "comboList.roundRobin", fusion: "comboList.fusion" };

// /gateway/routing/new creates; ?combo=<id> edits that combo.
export function ComboCreate() {
  const { language, t } = useLocale();
  const comboId = new URLSearchParams(window.location.search).get("combo");
  const combos = useCombos();
  if (!comboId) return <ComboForm others={combos.data ?? []} />;
  const heading = <PageHeading eyebrow={t("comboForm.editEyebrow")} title={t("comboForm.editTitle")} description={t("comboForm.editDescription")} action={<Link to="/gateway/routing" className="button button-secondary">{t("comboForm.back")}</Link>} />;
  if (combos.isPending) return <>{heading}<StateBlock state="loading" /></>;
  if (combos.isError) return <>{heading}<StateBlock state="error" code={toProblem(combos.error, language).code} action={<Button onClick={() => void combos.refetch()}>{t("common.retry")}</Button>} /><Warning tone="danger">{toProblem(combos.error, language).message}</Warning></>;
  const combo = combos.data.find((item) => item.id === comboId);
  if (!combo) return <>{heading}<div className="state-block"><strong>{t("comboForm.notFound")}</strong><p>{t("comboForm.notFoundHint")}</p><Link to="/gateway/routing" className="button button-primary">{t("comboForm.back")}</Link></div></>;
  return <ComboForm key={combo.id} combo={combo} others={combos.data} />;
}

function ComboForm({ combo, others }: { combo?: Combo; others: Combo[] }) {
  const { language, t } = useLocale();
  const navigate = useNavigate();
  const showToast = useToast();
  const create = useCreateCombo();
  const update = useUpdateCombo();
  const connectedModels = useConnectedModels();
  const nextId = useRef((combo?.models.length ?? 1) + 1);
  const [name, setName] = useState(combo?.name ?? "");
  const [mode, setMode] = useState<ComboStrategy>(combo?.strategy ?? "fallback");
  const [members, setMembers] = useState<Member[]>(() => (combo?.models ?? [""]).map((model, index) => ({ id: index + 1, model })));
  const [minPanel, setMinPanel] = useState(String(combo?.minPanel ?? 2));
  const [judgeModel, setJudgeModel] = useState(combo?.judgeModel ?? "");
  const [graceMs, setGraceMs] = useState(String(combo?.stragglerGraceMs ?? 8000));
  const [timeoutMs, setTimeoutMs] = useState(String(combo?.panelTimeoutMs ?? 90000));
  const [error, setError] = useState<MessageKey | null>(null);
  const [probes, setProbes] = useState<Record<string, Probe>>({});
  const comboNames = new Set(others.filter((item) => item.id !== combo?.id).map((item) => item.name));
  const modelOptions = new Set([...(connectedModels.data ?? []).map((model) => model.id).filter((model) => model !== combo?.name), ...comboNames]);
  const pending = create.isPending || update.isPending;
  const fail = (err: unknown) => showToast({ tone: "error", error: err });

  function changeMembers(change: (current: Member[]) => Member[]) {
    setMembers(change);
    setError(null);
  }

  function moveMember(index: number, offset: number) {
    changeMembers((current) => {
      const reordered = [...current];
      [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
      return reordered;
    });
  }

  // POST /api/models/test: one real request through /v1 routing, as the provider Models panel does.
  function probe(model: string) {
    setProbes((current) => ({ ...current, [model]: "testing" }));
    testModel(model).then(
      (result) => {
        setProbes((current) => ({ ...current, [model]: result }));
        if (!result.ok) showToast({ tone: "error", code: "MODEL_TEST_FAILED", localized: result.error ? { key: "comboForm.probeFailed", params: { model, reason: result.error } } : { key: "comboForm.probeFailedUnknown", params: { model } } });
      },
      (err: unknown) => {
        setProbes((current) => ({ ...current, [model]: { ok: false, latencyMs: 0, status: 0, error: toProblem(err, language).message } }));
        fail(err);
      },
    );
  }

  function status(model: string) {
    if (comboNames.has(model)) return <Pill tone="info">{t("routingStatus.tabCombo")}</Pill>;
    const result = probes[model];
    if (result === "testing") return <Pill>{t("comboForm.testing")}</Pill>;
    if (result) return <Pill tone={result.ok ? "healthy" : "danger"}>{result.ok ? `OK · ${result.latencyMs} ms` : t("comboForm.failed")}</Pill>;
    return <Button variant="ghost" disabled={model === ""} onClick={() => probe(model)}>{t("comboForm.test")}</Button>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const models = members.map((member) => member.model.trim());
    if (new Set(models).size !== models.length) {
      setError("comboForm.duplicateMember");
      return;
    }
    const fields: ComboFields = {
      name: name.trim(), models, strategy: mode, judgeModel: judgeModel.trim() || null,
      minPanel: Number(minPanel), stragglerGraceMs: Number(graceMs), panelTimeoutMs: Number(timeoutMs),
    };
    const saved = (result: Combo) => {
      showToast({ tone: "success", localized: { key: combo ? "comboForm.saved" : "comboForm.created", params: { name: result.name } } });
      void navigate({ to: "/gateway/routing" });
    };
    if (combo) update.mutate({ id: combo.id, ...fields }, { onSuccess: saved, onError: fail });
    else create.mutate(fields, { onSuccess: saved, onError: fail });
  }

  return <>
    <PageHeading eyebrow={t(combo ? "comboForm.editEyebrow" : "comboForm.newEyebrow")} title={t(combo ? "comboForm.editTitle" : "comboForm.createTitle")} description={t(combo ? "comboForm.editDescription" : "comboForm.createDescription")} action={<Link to="/gateway/routing" className="button button-secondary">{t("comboForm.back")}</Link>} />
    <form className="stack" onSubmit={handleSubmit}>
      <Panel title={t("comboForm.identity")} detail={t("comboForm.identityHint")}>
        <Field label={t("comboForm.name")} hint={t("comboForm.nameHint")}>
          <input className="input" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} required pattern="[A-Za-z0-9._\-]+" maxLength={64} placeholder={t("comboForm.namePlaceholder")} />
        </Field>
      </Panel>
      <Panel title={t("comboForm.strategy")} detail={t("comboForm.strategyHint")}>
        <fieldset className="combo-modes"><legend className="field-label">{t("comboForm.mode")}</legend>
          {(["fallback", "round-robin", "fusion"] as const).map((option) => <label className="combo-mode" key={option}>
            <input type="radio" name="combo-mode" checked={mode === option} onChange={() => setMode(option)} />
            <span><strong>{t(modeLabels[option])}</strong><small>{t(modeDetails[option])}</small></span>
          </label>)}
        </fieldset>
        {mode === "round-robin" && <p className="muted combo-note">{t("comboForm.rotationHint")}</p>}
      </Panel>
      <Panel title={t("comboForm.members")} detail={t("comboForm.membersHint")} action={<Button disabled={members.length >= MAX_MEMBERS} onClick={() => changeMembers((current) => [...current, { id: nextId.current++, model: "" }])}>+ {t("comboForm.addModel")}</Button>}>
        <div className="combo-members">{members.map((member, index) => <div className="combo-member" key={member.id}>
          <span className="combo-member-order">{String(index + 1).padStart(2, "0")}</span>
          <label className="field"><span>{t("comboForm.model")}</span><input className="input mono" list="combo-models" value={member.model} required maxLength={200} placeholder="openai/gpt-4.1" onChange={(event) => changeMembers((current) => current.map((item) => item.id === member.id ? { ...item, model: event.target.value } : item))} /></label>
          {status(member.model.trim())}
          <div className="combo-member-actions"><button type="button" className="button button-ghost" aria-label={t("comboForm.moveUp", { index: index + 1 })} disabled={index === 0} onClick={() => moveMember(index, -1)}>↑</button><button type="button" className="button button-ghost" aria-label={t("comboForm.moveDown", { index: index + 1 })} disabled={index === members.length - 1} onClick={() => moveMember(index, 1)}>↓</button><button type="button" className="button button-ghost" aria-label={t("comboForm.removeModel", { index: index + 1 })} disabled={members.length === 1} onClick={() => changeMembers((current) => current.filter((item) => item.id !== member.id))}>{t("comboList.delete")}</button></div>
        </div>)}</div>
        <datalist id="combo-models">{[...modelOptions].map((model) => <option key={model} value={model} />)}</datalist>
        <p className="muted combo-note">{t("comboForm.memberHelp")}</p>
      </Panel>
      {mode === "fusion" && <Panel title={t("comboForm.fusionSettings")} detail={t("comboForm.fusionSettingsHint")}>
        <Warning>{t("comboForm.fusionWarning", { calls: members.length + 1, parallel: FUSION_PARALLEL })}</Warning>
        <div className="grid grid-2 section-gap">
          <Field label={t("comboForm.minPanel")} hint={t("comboForm.minPanelHint")}><input className="input" type="number" min="2" max={MAX_MEMBERS} step="1" required value={minPanel} onChange={(event) => setMinPanel(event.target.value)} /></Field>
          <Field label={t("comboForm.judge")} hint={t("comboForm.judgeHint")}><input className="input mono" list="combo-models" maxLength={200} value={judgeModel} placeholder={t("comboForm.judgePlaceholder", { model: members[0]?.model.trim() || t("comboForm.firstMember") })} onChange={(event) => setJudgeModel(event.target.value)} /></Field>
          <Field label={t("comboForm.grace")} hint={t("comboForm.graceHint")}><input className="input" type="number" min="0" max="60000" step="1" required value={graceMs} onChange={(event) => setGraceMs(event.target.value)} /></Field>
          <Field label={t("comboForm.timeout")} hint={t("comboForm.timeoutHint")}><input className="input" type="number" min="1000" max="300000" step="1" required value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} /></Field>
        </div>
      </Panel>}
      {error && <div className="warning warning-danger" role="alert">{t(error)}</div>}
      <div className="combo-form-actions"><Link to="/gateway/routing" className="button button-secondary">{t("common.cancel")}</Link><Button type="submit" variant="primary" disabled={pending}>{pending ? t("comboForm.saving") : t(combo ? "comboForm.save" : "comboForm.createTitle")}</Button></div>
    </form>
  </>;
}
