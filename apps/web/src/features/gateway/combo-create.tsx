import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Field, PageHeading, Panel, Pill, Warning } from "../../shared/ui";

type Mode = "fallback" | "round-robin" | "fusion";
type Member = { id: number; model: string };

const modeDetails: Record<Mode, string> = {
  fallback: "Try members in the order shown until one succeeds.",
  "round-robin": "Rotate the first member on each request.",
  fusion: "Run a bounded panel and choose a result with the judge model.",
};

const previewModels = [
  { id: "claude-3.5-sonnet", provider: "Anthropic" },
  { id: "gpt-4o", provider: "OpenAI" },
  { id: "gemini-2.5-pro", provider: "Google Vertex" },
  { id: "deepseek-r1", provider: "DeepSeek" },
] as const;

export function ComboCreate() {
  const nextId = useRef(2);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("fallback");
  const [members, setMembers] = useState<Member[]>([{ id: 1, model: "" }]);
  const [minimumPanel, setMinimumPanel] = useState("2");
  const [judgeModel, setJudgeModel] = useState("");
  const [graceMs, setGraceMs] = useState("200");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [maxParallel, setMaxParallel] = useState("2");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<object | null>(null);

  function changeMembers(update: (current: Member[]) => Member[]) {
    setMembers(update);
    setError("");
    setPreview(null);
  }

  function moveMember(index: number, offset: number) {
    changeMembers((current) => {
      const reordered = [...current];
      [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
      return reordered;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const models = members.map((member) => member.model.trim());
    if (new Set(models).size !== models.length) {
      setError("Each member must use a different model ID.");
      return;
    }
    if (mode === "fusion") {
      const panel = Number(minimumPanel);
      const parallel = Number(maxParallel);
      const grace = Number(graceMs);
      const timeout = Number(timeoutMs);
      if (models.length < 2 || panel > models.length || parallel > models.length || parallel < panel || grace >= timeout) {
        setError("Fusion needs at least two models, a panel and concurrency limit within the member count, and a grace period shorter than the hard timeout.");
        return;
      }
    }
    setError("");
    setPreview({
      name: name.trim(),
      strategy: mode,
      models,
      ...(mode === "fusion" ? {
        fusion: {
          minimumPanel: Number(minimumPanel),
          judgeModel: judgeModel.trim(),
          stragglerGraceMs: Number(graceMs),
          hardTimeoutMs: Number(timeoutMs),
          maxParallel: Number(maxParallel),
        },
      } : {}),
    });
  }

  return <>
    <PageHeading eyebrow="Gateway / Routing / New combo" title="Create combo" description="Set a model order and routing strategy. This form previews a draft; saving requires the gateway API." action={<Link to="/gateway/routing" className="button button-secondary">Back to routing</Link>} />
    <form className="stack" onSubmit={handleSubmit} onChange={() => { setError(""); setPreview(null); }}>
      <Panel title="Combo identity" detail="Clients will use this name as the combo model ID.">
        <Field label="Combo name" hint="Letters, numbers, hyphens, underscores and periods only.">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required pattern="[A-Za-z0-9._-]+" maxLength={64} placeholder="e.g. coding-fast" />
        </Field>
      </Panel>
      <Panel title="Routing strategy" detail="Choose how requests pass through the members.">
        <fieldset className="combo-modes"><legend className="field-label">Mode</legend>
          {(["fallback", "round-robin", "fusion"] as const).map((option) => <label className="combo-mode" key={option}>
            <input type="radio" name="combo-mode" checked={mode === option} onChange={() => setMode(option)} />
            <span><strong>{option === "round-robin" ? "Round robin" : option[0].toUpperCase() + option.slice(1)}</strong><small>{modeDetails[option]}</small></span>
          </label>)}
        </fieldset>
      </Panel>
      <Panel title="Members" detail="Choose models in routing order. Use the arrows to change priority." action={<Button disabled={members.length >= previewModels.length} onClick={() => changeMembers((current) => [...current, { id: nextId.current++, model: "" }])}>+ Add model</Button>}>
        <div className="combo-members">{members.map((member, index) => <div className="combo-member" key={member.id}>
          <span className="combo-member-order">{String(index + 1).padStart(2, "0")}</span>
          <label className="field"><span>Model</span><select className="input" value={member.model} onChange={(event) => changeMembers((current) => current.map((item) => item.id === member.id ? { ...item, model: event.target.value } : item))} required><option value="">Select a model</option>{previewModels.map((model) => <option key={model.id} value={model.id} disabled={members.some((item) => item.id !== member.id && item.model === model.id)}>{model.provider} · {model.id}</option>)}</select></label>
          <Pill tone="muted">Unverified</Pill>
          <div className="combo-member-actions"><button type="button" className="button button-ghost" aria-label={`Move model ${index + 1} up`} disabled={index === 0} onClick={() => moveMember(index, -1)}>↑</button><button type="button" className="button button-ghost" aria-label={`Move model ${index + 1} down`} disabled={index === members.length - 1} onClick={() => moveMember(index, 1)}>↓</button><button type="button" className="button button-ghost" aria-label={`Remove model ${index + 1}`} disabled={members.length === 1} onClick={() => changeMembers((current) => current.filter((item) => item.id !== member.id))}>Remove</button></div>
        </div>)}</div>
        <p className="muted combo-note">These are sample models from the Routing preview. Live options, availability, and capabilities will come from provider connections.</p>
      </Panel>
      {mode === "fusion" && <Panel title="Fusion settings" detail="Bound fan-out and decide when to stop waiting for slow members.">
        <Warning>Fusion can send multiple upstream requests for one client request.</Warning>
        <div className="grid grid-2 section-gap">
          <Field label="Minimum panel size"><input className="input" type="number" min="2" step="1" required value={minimumPanel} onChange={(event) => setMinimumPanel(event.target.value)} /></Field>
          <Field label="Judge model"><select className="input" required value={judgeModel} onChange={(event) => setJudgeModel(event.target.value)}><option value="">Select a model</option>{previewModels.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.id}</option>)}</select></Field>
          <Field label="Straggler grace (ms)"><input className="input" type="number" min="0" step="1" required value={graceMs} onChange={(event) => setGraceMs(event.target.value)} /></Field>
          <Field label="Hard timeout (ms)"><input className="input" type="number" min="1" step="1" required value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} /></Field>
          <Field label="Maximum parallel calls"><input className="input" type="number" min="1" step="1" required value={maxParallel} onChange={(event) => setMaxParallel(event.target.value)} /></Field>
        </div>
      </Panel>}
      {error && <div className="warning warning-danger" role="alert">{error}</div>}
      <div className="combo-form-actions"><Link to="/gateway/routing" className="button button-secondary">Cancel</Link><Button type="submit" variant="primary">Preview combo</Button></div>
    </form>
    {preview && <Panel title="Draft preview" detail="Local preview only. No combo has been saved." className="section-gap" action={<Pill tone="warning">Unsaved</Pill>}><pre className="code-block">{JSON.stringify(preview, null, 2)}</pre></Panel>}
  </>;
}
