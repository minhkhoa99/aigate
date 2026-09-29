import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { testModel, useCombos, useConnectedModels, useCreateCombo, useUpdateCombo, type Combo, type ComboFields, type ComboStrategy, type ModelProbe } from "./api";

// docs/contracts/combos.md: the server's bounds, shown so the form does not promise more.
const MAX_MEMBERS = 16;
const FUSION_PARALLEL = 4;

type Member = { id: number; model: string };
type Probe = "testing" | ModelProbe;

const modeDetails: Record<ComboStrategy, string> = {
  fallback: "Try members in the order shown until one answers.",
  "round-robin": "Start each request at the next member; the others stay as fallback.",
  fusion: "Ask every member, then the judge writes one answer. Costs one call per member plus the judge.",
};
const modeLabel = (mode: ComboStrategy) => (mode === "round-robin" ? "Round robin" : mode[0].toUpperCase() + mode.slice(1));

// /gateway/routing/new creates; ?combo=<id> edits that combo.
export function ComboCreate() {
  const comboId = new URLSearchParams(window.location.search).get("combo");
  const combos = useCombos();
  if (!comboId) return <ComboForm others={combos.data ?? []} />;
  const heading = <PageHeading eyebrow="Gateway / Routing / Edit combo" title="Edit combo" description="Change the members, their order, or the routing strategy." action={<Link to="/gateway/routing" className="button button-secondary">Back to routing</Link>} />;
  if (combos.isPending) return <>{heading}<StateBlock state="loading" /></>;
  if (combos.isError) return <>{heading}<StateBlock state="error" code={toProblem(combos.error).code} action={<Button onClick={() => void combos.refetch()}>Retry</Button>} /></>;
  const combo = combos.data.find((item) => item.id === comboId);
  if (!combo) return <>{heading}<div className="state-block"><strong>Combo not found</strong><p>It may have been deleted in another tab.</p><Link to="/gateway/routing" className="button button-primary">Back to routing</Link></div></>;
  return <ComboForm key={combo.id} combo={combo} others={combos.data} />;
}

function ComboForm({ combo, others }: { combo?: Combo; others: Combo[] }) {
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
  const [error, setError] = useState("");
  const [probes, setProbes] = useState<Record<string, Probe>>({});
  const comboNames = new Set(others.filter((item) => item.id !== combo?.id).map((item) => item.name));
  const modelOptions = new Set([...(connectedModels.data ?? []).map((model) => model.id).filter((model) => model !== combo?.name), ...comboNames]);
  const pending = create.isPending || update.isPending;
  const fail = (err: unknown) => showToast({ tone: "error", ...toProblem(err) });

  function changeMembers(change: (current: Member[]) => Member[]) {
    setMembers(change);
    setError("");
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
        if (!result.ok) showToast({ tone: "error", code: "MODEL_TEST_FAILED", message: `${model}: ${result.error ?? "the test failed"}` });
      },
      (err: unknown) => {
        setProbes((current) => ({ ...current, [model]: { ok: false, latencyMs: 0, status: 0, error: toProblem(err).message } }));
        fail(err);
      },
    );
  }

  function status(model: string) {
    if (comboNames.has(model)) return <Pill tone="info">Combo</Pill>;
    const result = probes[model];
    if (result === "testing") return <Pill>Testing…</Pill>;
    if (result) return <Pill tone={result.ok ? "healthy" : "danger"}>{result.ok ? `OK · ${result.latencyMs} ms` : "Failed"}</Pill>;
    return <Button variant="ghost" disabled={model === ""} onClick={() => probe(model)}>Test</Button>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const models = members.map((member) => member.model.trim());
    if (new Set(models).size !== models.length) {
      setError("Each member must be a different model.");
      return;
    }
    const fields: ComboFields = {
      name: name.trim(), models, strategy: mode, judgeModel: judgeModel.trim() || null,
      minPanel: Number(minPanel), stragglerGraceMs: Number(graceMs), panelTimeoutMs: Number(timeoutMs),
    };
    const saved = (result: Combo) => {
      showToast({ tone: "success", message: combo ? `Saved ${result.name}.` : `Created ${result.name}. Clients can send it as the model.` });
      void navigate({ to: "/gateway/routing" });
    };
    if (combo) update.mutate({ id: combo.id, ...fields }, { onSuccess: saved, onError: fail });
    else create.mutate(fields, { onSuccess: saved, onError: fail });
  }

  return <>
    <PageHeading eyebrow={`Gateway / Routing / ${combo ? "Edit combo" : "New combo"}`} title={combo ? "Edit combo" : "Create combo"} description="Set a model order and routing strategy. Clients send the combo's name as the model." action={<Link to="/gateway/routing" className="button button-secondary">Back to routing</Link>} />
    <form className="stack" onSubmit={handleSubmit}>
      <Panel title="Combo identity" detail="Clients will use this name as the model ID; GET /v1/models lists it.">
        <Field label="Combo name" hint="Letters, numbers, hyphens, underscores and periods only. A name without / wins over a catalog model of the same ID.">
          <input className="input" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} required pattern="[A-Za-z0-9._\-]+" maxLength={64} placeholder="e.g. coding-fast" />
        </Field>
      </Panel>
      <Panel title="Routing strategy" detail="Choose how requests pass through the members.">
        <fieldset className="combo-modes"><legend className="field-label">Mode</legend>
          {(["fallback", "round-robin", "fusion"] as const).map((option) => <label className="combo-mode" key={option}>
            <input type="radio" name="combo-mode" checked={mode === option} onChange={() => setMode(option)} />
            <span><strong>{modeLabel(option)}</strong><small>{modeDetails[option]}</small></span>
          </label>)}
        </fieldset>
        {mode === "round-robin" && <p className="muted combo-note">How many requests a member serves before the start moves on is set once for all round-robin combos, on the Routing page.</p>}
      </Panel>
      <Panel title="Members" detail="Models in routing order. Use the arrows to change priority." action={<Button disabled={members.length >= MAX_MEMBERS} onClick={() => changeMembers((current) => [...current, { id: nextId.current++, model: "" }])}>+ Add model</Button>}>
        <div className="combo-members">{members.map((member, index) => <div className="combo-member" key={member.id}>
          <span className="combo-member-order">{String(index + 1).padStart(2, "0")}</span>
          <label className="field"><span>Model</span><input className="input mono" list="combo-models" value={member.model} required maxLength={200} placeholder="openai/gpt-4.1" onChange={(event) => changeMembers((current) => current.map((item) => item.id === member.id ? { ...item, model: event.target.value } : item))} /></label>
          {status(member.model.trim())}
          <div className="combo-member-actions"><button type="button" className="button button-ghost" aria-label={`Move model ${index + 1} up`} disabled={index === 0} onClick={() => moveMember(index, -1)}>↑</button><button type="button" className="button button-ghost" aria-label={`Move model ${index + 1} down`} disabled={index === members.length - 1} onClick={() => moveMember(index, 1)}>↓</button><button type="button" className="button button-ghost" aria-label={`Remove model ${index + 1}`} disabled={members.length === 1} onClick={() => changeMembers((current) => current.filter((item) => item.id !== member.id))}>Remove</button></div>
        </div>)}</div>
        <datalist id="combo-models">{[...modelOptions].map((model) => <option key={model} value={model} />)}</datalist>
        <p className="muted combo-note">Use <code>provider/model</code> (as on a provider's Models panel), a bare catalog model ID, or another combo's name (up to 3 combos deep). Test sends one real request through the member's connection.</p>
      </Panel>
      {mode === "fusion" && <Panel title="Fusion settings" detail="Decide when to stop waiting for slow members and who writes the final answer.">
        <Warning>Each request calls every member plus the judge ({members.length + 1} upstream calls). At most {FUSION_PARALLEL} members run at once; members still running when the panel closes are cancelled.</Warning>
        <div className="grid grid-2 section-gap">
          <Field label="Minimum panel size" hint="Answers needed before the straggler grace starts; at least 2."><input className="input" type="number" min="2" max={MAX_MEMBERS} step="1" required value={minPanel} onChange={(event) => setMinPanel(event.target.value)} /></Field>
          <Field label="Judge model" hint="Empty: the first member judges."><input className="input mono" list="combo-models" maxLength={200} value={judgeModel} placeholder={`Auto — ${members[0]?.model.trim() || "first member"}`} onChange={(event) => setJudgeModel(event.target.value)} /></Field>
          <Field label="Straggler grace (ms)" hint="Wait this long for the rest once the minimum panel answered."><input className="input" type="number" min="0" max="60000" step="1" required value={graceMs} onChange={(event) => setGraceMs(event.target.value)} /></Field>
          <Field label="Hard timeout (ms)" hint="The panel closes at this point whatever answered."><input className="input" type="number" min="1000" max="300000" step="1" required value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} /></Field>
        </div>
      </Panel>}
      {error && <div className="warning warning-danger" role="alert">{error}</div>}
      <div className="combo-form-actions"><Link to="/gateway/routing" className="button button-secondary">Cancel</Link><Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : combo ? "Save combo" : "Create combo"}</Button></div>
    </form>
  </>;
}
