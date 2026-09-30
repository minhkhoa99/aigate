import { useEffect, useState } from "react";
import { Button, Field, Modal, Pill, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useProvider, useProviderNodes, useProviders } from "../providers/api";
import { usePriceOverrides, usePricingEdits, useResolvedPrice, type Price, type PriceField } from "./api";

// docs/contracts/usage.md "UI": the resolved rate of a provider and model, its source, and the user's overrides.

const FIELDS: { key: PriceField; label: string }[] = [
  { key: "input", label: "Input" }, { key: "output", label: "Output" }, { key: "cached", label: "Cache read" },
  { key: "cache_creation", label: "Cache write" }, { key: "reasoning", label: "Reasoning" },
];
const SOURCE: Record<string, string> = {
  override: "Your override", provider: "Built-in, this provider", model: "Built-in, this model", pattern: "Built-in, a model family", none: "No price: calls are counted as unpriced",
};
const rate = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `$${value}`);
const EMPTY: Record<PriceField, string> = { input: "", output: "", cached: "", cache_creation: "", reasoning: "" };

export function PricingModal({ onClose }: { onClose: () => void }) {
  const showToast = useToast();
  const providers = useProviders();
  const nodes = useProviderNodes();
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const isNode = (nodes.data ?? []).some((node) => node.id === provider);
  const detail = useProvider(provider, Boolean(provider) && !isNode);
  const resolved = useResolvedPrice(provider, model.trim());
  const overrides = usePriceOverrides();
  const { save, reset } = usePricingEdits();
  const [draft, setDraft] = useState<Record<PriceField, string>>(EMPTY);

  const price = resolved.data?.price;
  useEffect(() => {
    setDraft({ ...EMPTY, ...Object.fromEntries(FIELDS.map(({ key }) => [key, price?.[key] === undefined ? "" : String(price[key])])) });
  }, [price]);

  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const submit = () => {
    const fields: Partial<Price> = {};
    for (const { key, label } of FIELDS) {
      const text = draft[key].trim();
      if (text === "") continue;
      const value = Number(text);
      if (!Number.isFinite(value) || value < 0) return showToast({ tone: "error", message: `${label} must be a number of 0 or more (USD per 1M tokens).` });
      if (price?.[key] !== value) fields[key] = value;
    }
    if (Object.keys(fields).length === 0) return showToast({ tone: "error", message: "Change at least one rate before saving." });
    save.mutate({ provider, model: model.trim(), fields }, { onSuccess: () => showToast({ tone: "success", message: `Saved the price of ${provider}/${model.trim()}.` }), onError: fail });
  };
  const models = (detail.data?.models ?? []).filter((item) => item.kind === "chat");

  return <Modal title="Pricing" onClose={onClose}>
    <p>Rates are USD per 1M tokens. An override changes only the rates you set; the rest keep the built-in price. Past usage keeps the cost it was recorded with.</p>
    <div className="stack">
      <Field label="Provider"><select className="input" value={provider} onChange={(event) => { setProvider(event.target.value); setModel(""); }}>
        {(nodes.data ?? []).length > 0 && <optgroup label="Custom providers">{(nodes.data ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} ({node.prefix})</option>)}</optgroup>}
        <optgroup label="Built-in">{(providers.data ?? []).filter((item) => item.connectable).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
      </select></Field>
      <Field label="Model" hint="Pick a catalog model or type any model id this provider serves.">
        <input className="input" list="pricing-models" value={model} maxLength={200} placeholder="e.g. gpt-4.1" onChange={(event) => setModel(event.target.value)} />
        <datalist id="pricing-models">{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
      </Field>
      {model.trim() && <div className="row between"><span className="muted">{resolved.isPending ? "Looking up the price…" : SOURCE[resolved.data?.source ?? "none"]}</span>
        {resolved.data?.source === "override" && <Button variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate({ provider, model: model.trim() }, { onError: fail })}>Reset to built-in</Button>}</div>}
      {model.trim() && <div className="pricing-fields">{FIELDS.map(({ key, label }) => <Field key={key} label={label}>
        <input className="input" inputMode="decimal" value={draft[key]} placeholder={key === "input" || key === "output" ? "0" : "same as input/output"} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
      </Field>)}</div>}
    </div>
    <div className="modal-actions"><Button onClick={onClose}>Close</Button><Button variant="primary" disabled={!model.trim() || save.isPending} onClick={submit}>{save.isPending ? "Saving…" : "Save price"}</Button></div>

    <h3 className="pricing-heading">Your overrides {overrides.data && <Pill>{overrides.data.overrides.length}</Pill>}</h3>
    {overrides.isError ? <p className="text-danger">{toProblem(overrides.error).message}</p>
      : <Table columns={["Model", "In", "Out", "Cache read", ""]} empty="No overrides: every price is built in."
        rows={(overrides.data?.overrides ?? []).map((row) => [<code>{row.provider}/{row.model}</code>, rate(row.input), rate(row.output), rate(row.cached),
          <button className="button button-ghost" aria-label={`Reset ${row.provider}/${row.model}`} onClick={() => reset.mutate({ provider: row.provider, model: row.model }, { onError: fail })}>Reset</button>])} />}
    {(overrides.data?.overrides.length ?? 0) > 0 && <div className="modal-actions"><Button variant="danger" disabled={reset.isPending} onClick={() => reset.mutate({}, { onSuccess: () => showToast({ tone: "success", message: "Every price is back to built-in." }), onError: fail })}>Reset all</Button></div>}
  </Modal>;
}
