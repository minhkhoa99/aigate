import { useState, type FormEvent } from "react";
import { Button, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import type { MessageKey } from "../../shared/i18n";
import { testModel, useCapacityPools, useConnectedModels, useSaveCapacityPool, type CapacityCapability, type CapacityPool, type ModelProbe } from "./api";

// docs/contracts/capacity-adapter.md: the server accepts all four pools; PDF and video stay hidden, as in 9router.
const SHOWN: { capability: CapacityCapability; label: MessageKey; detail: MessageKey }[] = [
  { capability: "vision", label: "capacity.vision", detail: "capacity.visionHint" },
  { capability: "audioInput", label: "capacity.audio", detail: "capacity.audioHint" },
];
// The server's limit for one pool.
const MAX_MODELS = 16;

export function CapacityTab() {
  const { language, t } = useLocale();
  const pools = useCapacityPools();
  const connectedModels = useConnectedModels();
  return <div className="stack section-gap">
    <Panel title={t("capacity.title")} detail={t("capacity.detail")}>
      {pools.isPending ? <StateBlock state="loading" />
        : pools.isError ? <><StateBlock state="error" code={toProblem(pools.error, language).code} action={<Button onClick={() => void pools.refetch()}>{t("common.retry")}</Button>} /><Warning tone="danger">{toProblem(pools.error, language).message}</Warning></>
        : <div className="grid grid-2">{SHOWN.map((shown) => {
          const pool = pools.data.find((item) => item.capability === shown.capability);
          return pool && <PoolCard key={`${pool.capability}:${pool.updatedAt ?? "new"}`} pool={pool} label={t(shown.label)} detail={t(shown.detail)} />;
        })}</div>}
    </Panel>
    <datalist id="capacity-models">{(connectedModels.data ?? []).map((model) => <option key={model.id} value={model.id} />)}</datalist>
  </div>;
}

function PoolCard({ pool, label, detail }: { pool: CapacityPool; label: string; detail: string }) {
  const { language, t } = useLocale();
  const save = useSaveCapacityPool();
  const showToast = useToast();
  const [enabled, setEnabled] = useState(pool.enabled);
  const [roundRobin, setRoundRobin] = useState(pool.roundRobin);
  const [models, setModels] = useState(pool.models);
  const [draft, setDraft] = useState("");
  const [errorModel, setErrorModel] = useState("");
  const [probes, setProbes] = useState<Record<string, ModelProbe | "testing">>({});
  const changed = enabled !== pool.enabled || roundRobin !== pool.roundRobin || models.join("\n") !== pool.models.join("\n");
  const fail = (err: unknown) => showToast({ tone: "error", error: err });

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const model = draft.trim();
    if (models.includes(model)) {
      setErrorModel(model);
      return;
    }
    setModels((current) => [...current, model]);
    setDraft("");
    setErrorModel("");
  }

  function move(index: number, offset: number) {
    setModels((current) => {
      const reordered = [...current];
      [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
      return reordered;
    });
  }

  function remove(model: string) {
    const rest = models.filter((item) => item !== model);
    setModels(rest);
    if (rest.length === 0) setEnabled(false);
  }

  // POST /api/models/test: one real request through /v1 routing, as the combo form does.
  function probe(model: string) {
    setProbes((current) => ({ ...current, [model]: "testing" }));
    testModel(model).then(
      (result) => {
        setProbes((current) => ({ ...current, [model]: result }));
        if (!result.ok) showToast({ tone: "error", code: "MODEL_TEST_FAILED", localized: result.error ? { key: "capacity.probeFailed", params: { model, reason: result.error } } : { key: "capacity.probeFailedUnknown", params: { model } } });
      },
      (err: unknown) => {
        setProbes((current) => ({ ...current, [model]: { ok: false, latencyMs: 0, status: 0, error: toProblem(err, language).message } }));
        fail(err);
      },
    );
  }

  function status(model: string) {
    const result = probes[model];
    if (result === "testing") return <Pill>{t("capacity.testing")}</Pill>;
    if (result) return <Pill tone={result.ok ? "healthy" : "danger"}>{result.ok ? `OK · ${result.latencyMs} ms` : t("capacity.failed")}</Pill>;
    return <Button variant="ghost" onClick={() => probe(model)}>{t("capacity.test")}</Button>;
  }

  function submit() {
    save.mutate({ capability: pool.capability, enabled, roundRobin, models }, {
      onSuccess: (saved) => showToast({ tone: "success", localized: { key: saved.enabled
        ? (pool.capability === "vision" ? "capacity.savedVision" : "capacity.savedAudio")
        : (pool.capability === "vision" ? "capacity.savedVisionOff" : "capacity.savedAudioOff") } }),
      onError: fail,
    });
  }

  return <Panel title={label} detail={detail} action={<Pill tone={pool.enabled ? "healthy" : "muted"}>{pool.enabled ? t("capacity.on") : t("capacity.off")}</Pill>}>
    <div className="list-row"><div><strong>{t("capacity.on")}</strong><small>{models.length === 0 ? t("capacity.addFirst") : t("capacity.usePool")}</small></div>
      <input type="checkbox" checked={enabled} disabled={models.length === 0} onChange={(event) => setEnabled(event.target.checked)} aria-label={t("capacity.turnOn", { pool: label })} /></div>
    <div className="list-row"><div><strong>{t("capacity.roundRobin")}</strong><small>{t("capacity.roundRobinHint")}</small></div>
      <input type="checkbox" checked={roundRobin} onChange={(event) => setRoundRobin(event.target.checked)} aria-label={t("capacity.roundRobinAria", { pool: label })} /></div>
    <div className="combo-members">{models.map((model, index) => <div className="combo-member" key={model}>
      <span className="combo-member-order">{String(index + 1).padStart(2, "0")}</span>
      <code>{model}</code>
      {status(model)}
      <div className="combo-member-actions">
        <button type="button" className="button button-ghost" aria-label={t("capacity.moveUp", { model })} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="button button-ghost" aria-label={t("capacity.moveDown", { model })} disabled={index === models.length - 1} onClick={() => move(index, 1)}>↓</button>
        <button type="button" className="button button-ghost" aria-label={t("capacity.remove", { model })} onClick={() => remove(model)}>{t("comboList.delete")}</button>
      </div>
    </div>)}</div>
    <form className="list-row" onSubmit={add}>
      <input className="input mono" list="capacity-models" value={draft} required maxLength={200} placeholder="provider/model" aria-label={t("capacity.addModelAria", { pool: label })} onChange={(event) => { setDraft(event.target.value); setErrorModel(""); }} />
      <Button type="submit" disabled={models.length >= MAX_MODELS}>{t("capacity.add")}</Button>
    </form>
    {errorModel && <div className="warning warning-danger" role="alert">{t("capacity.duplicateModel", { model: errorModel })}</div>}
    <p className="muted combo-note">{t("capacity.compatibleHint", { limit: MAX_MODELS })}</p>
    <Button variant="primary" disabled={!changed || save.isPending} onClick={submit}>{save.isPending ? t("capacity.saving") : t("capacity.save")}</Button>
  </Panel>;
}
