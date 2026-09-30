import { useState, type FormEvent } from "react";
import { Button, Panel, Pill, StateBlock } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { testModel, useCapacityPools, useConnectedModels, useSaveCapacityPool, type CapacityCapability, type CapacityPool, type ModelProbe } from "./api";

// docs/contracts/capacity-adapter.md: the server accepts all four pools; PDF and video stay hidden, as in 9router.
const SHOWN: { capability: CapacityCapability; label: string; detail: string }[] = [
  { capability: "vision", label: "Vision", detail: "Requests with images (PNG, JPEG, WebP, and more)." },
  { capability: "audioInput", label: "Audio input", detail: "Requests with audio input." },
];
// The server's limit for one pool.
const MAX_MODELS = 16;

export function CapacityTab() {
  const pools = useCapacityPools();
  const connectedModels = useConnectedModels();
  return <div className="stack section-gap">
    <Panel title="Capacity adapter" detail="When a request carries media that the requested model, or every member of its combo, cannot read, the models of the matching pool are tried first, each with older turns trimmed to fit its context window. The requested model stays as the last fallback. Pools start off.">
      {pools.isPending ? <StateBlock state="loading" />
        : pools.isError ? <StateBlock state="error" code={toProblem(pools.error).code} action={<Button onClick={() => void pools.refetch()}>Retry</Button>} />
        : <div className="grid grid-2">{SHOWN.map((shown) => {
          const pool = pools.data.find((item) => item.capability === shown.capability);
          return pool && <PoolCard key={`${pool.capability}:${pool.updatedAt ?? "new"}`} pool={pool} label={shown.label} detail={shown.detail} />;
        })}</div>}
    </Panel>
    <datalist id="capacity-models">{(connectedModels.data ?? []).map((model) => <option key={model.id} value={model.id} />)}</datalist>
  </div>;
}

function PoolCard({ pool, label, detail }: { pool: CapacityPool; label: string; detail: string }) {
  const save = useSaveCapacityPool();
  const showToast = useToast();
  const [enabled, setEnabled] = useState(pool.enabled);
  const [roundRobin, setRoundRobin] = useState(pool.roundRobin);
  const [models, setModels] = useState(pool.models);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [probes, setProbes] = useState<Record<string, ModelProbe | "testing">>({});
  const changed = enabled !== pool.enabled || roundRobin !== pool.roundRobin || models.join("\n") !== pool.models.join("\n");
  const fail = (err: unknown) => showToast({ tone: "error", ...toProblem(err) });

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const model = draft.trim();
    if (models.includes(model)) {
      setError(`${model} is already in this pool.`);
      return;
    }
    setModels((current) => [...current, model]);
    setDraft("");
    setError("");
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
        if (!result.ok) showToast({ tone: "error", code: "MODEL_TEST_FAILED", message: `${model}: ${result.error ?? "the test failed"}` });
      },
      (err: unknown) => {
        setProbes((current) => ({ ...current, [model]: { ok: false, latencyMs: 0, status: 0, error: toProblem(err).message } }));
        fail(err);
      },
    );
  }

  function status(model: string) {
    const result = probes[model];
    if (result === "testing") return <Pill>Testing…</Pill>;
    if (result) return <Pill tone={result.ok ? "healthy" : "danger"}>{result.ok ? `OK · ${result.latencyMs} ms` : "Failed"}</Pill>;
    return <Button variant="ghost" onClick={() => probe(model)}>Test</Button>;
  }

  function submit() {
    save.mutate({ capability: pool.capability, enabled, roundRobin, models }, {
      onSuccess: (saved) => showToast({ tone: "success", message: `${label} pool saved${saved.enabled ? "" : " (off)"}.` }),
      onError: fail,
    });
  }

  return <Panel title={label} detail={detail} action={<Pill tone={pool.enabled ? "healthy" : "muted"}>{pool.enabled ? "On" : "Off"}</Pill>}>
    <div className="list-row"><div><strong>On</strong><small>{models.length === 0 ? "Add a model first." : "Use this pool for requests that need it."}</small></div>
      <input type="checkbox" checked={enabled} disabled={models.length === 0} onChange={(event) => setEnabled(event.target.checked)} aria-label={`Turn the ${label} pool on`} /></div>
    <div className="list-row"><div><strong>Round robin</strong><small>Start from the next model on each request; off tries them in order.</small></div>
      <input type="checkbox" checked={roundRobin} onChange={(event) => setRoundRobin(event.target.checked)} aria-label={`Round robin for the ${label} pool`} /></div>
    <div className="combo-members">{models.map((model, index) => <div className="combo-member" key={model}>
      <span className="combo-member-order">{String(index + 1).padStart(2, "0")}</span>
      <code>{model}</code>
      {status(model)}
      <div className="combo-member-actions">
        <button type="button" className="button button-ghost" aria-label={`Move ${model} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="button button-ghost" aria-label={`Move ${model} down`} disabled={index === models.length - 1} onClick={() => move(index, 1)}>↓</button>
        <button type="button" className="button button-ghost" aria-label={`Remove ${model}`} onClick={() => remove(model)}>Remove</button>
      </div>
    </div>)}</div>
    <form className="list-row" onSubmit={add}>
      <input className="input mono" list="capacity-models" value={draft} required maxLength={200} placeholder="provider/model" aria-label={`Add a model to the ${label} pool`} onChange={(event) => { setDraft(event.target.value); setError(""); }} />
      <Button type="submit" disabled={models.length >= MAX_MODELS}>Add</Button>
    </form>
    {error && <div className="warning warning-danger" role="alert">{error}</div>}
    <p className="muted combo-note">Only models whose catalog entry reads this input are used; others in the list are skipped. Up to {MAX_MODELS} models.</p>
    <Button variant="primary" disabled={!changed || save.isPending} onClick={submit}>{save.isPending ? "Saving…" : "Save"}</Button>
  </Panel>;
}
