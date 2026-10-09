import { useEffect, useState } from "react";
import { Button, Field, Modal, Pill, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useProvider, useProviderNodes, useProviders } from "../providers/api";
import { usePriceOverrides, usePricingEdits, useResolvedPrice, type Price, type PriceField } from "./api";

// docs/contracts/usage.md "UI": the resolved rate of a provider and model, its source, and the user's overrides.

const FIELDS: PriceField[] = ["input", "output", "cached", "cache_creation", "reasoning"];
const rate = (value: number | null | undefined, locale: string) => (value === null || value === undefined ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 20 }).format(value));
const EMPTY: Record<PriceField, string> = { input: "", output: "", cached: "", cache_creation: "", reasoning: "" };

export function PricingModal({ onClose }: { onClose: () => void }) {
  const { language, t } = useLocale();
  const locale = language === "vi" ? "vi-VN" : "en-US";
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
    setDraft({ ...EMPTY, ...Object.fromEntries(FIELDS.map((key) => [key, price?.[key] === undefined ? "" : String(price[key])])) });
  }, [price]);

  const fail = (error: unknown) => showToast({ tone: "error", error });
  const submit = () => {
    const fields: Partial<Price> = {};
    for (const key of FIELDS) {
      const text = draft[key].trim();
      if (text === "") continue;
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) return showToast({ tone: "error", localized: { key: "pricing.invalidRate", params: { field: t(`pricing.field.${key}`) } } });
      if (price?.[key] !== value) fields[key] = value;
    }
    if (Object.keys(fields).length === 0) return showToast({ tone: "error", localized: { key: "pricing.changeRate" } });
    save.mutate({ provider, model: model.trim(), fields }, { onSuccess: () => showToast({ tone: "success", localized: { key: "pricing.saved", params: { name: `${provider}/${model.trim()}` } } }), onError: fail });
  };
  const models = (detail.data?.models ?? []).filter((item) => item.kind === "chat");

  return <Modal title={t("pricing.title")} onClose={onClose}>
    <p>{t("pricing.description")}</p>
    {providers.isError && <p className="text-danger"><code>{toProblem(providers.error, language).code}</code> · {toProblem(providers.error, language).message} <Button onClick={() => void providers.refetch()}>{t("common.retry")}</Button></p>}
    {nodes.isError && <p className="text-danger"><code>{toProblem(nodes.error, language).code}</code> · {toProblem(nodes.error, language).message} <Button onClick={() => void nodes.refetch()}>{t("common.retry")}</Button></p>}
    {detail.isError && <p className="text-danger"><code>{toProblem(detail.error, language).code}</code> · {toProblem(detail.error, language).message} <Button onClick={() => void detail.refetch()}>{t("common.retry")}</Button></p>}
    <div className="stack">
      <Field label={t("pricing.provider")}><select className="input" value={provider} onChange={(event) => { setProvider(event.target.value); setModel(""); }}>
        {(nodes.data ?? []).length > 0 && <optgroup label={t("pricing.customProviders")}>{(nodes.data ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} ({node.prefix})</option>)}</optgroup>}
        <optgroup label={t("pricing.builtin")}>{(providers.data ?? []).filter((item) => item.connectable).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
      </select></Field>
      <Field label={t("pricing.model")} hint={t("pricing.modelHint")}>
        <input className="input" list="pricing-models" value={model} maxLength={200} placeholder="e.g. gpt-4.1" onChange={(event) => setModel(event.target.value)} />
        <datalist id="pricing-models">{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
      </Field>
      {model.trim() && <div className="row between"><span className="muted">{resolved.isPending ? t("pricing.lookingUp") : resolved.isError ? <><code>{toProblem(resolved.error, language).code}</code> · {toProblem(resolved.error, language).message} <Button onClick={() => void resolved.refetch()}>{t("common.retry")}</Button></> : t(`pricing.source.${resolved.data?.source ?? "none"}`)}</span>
        {resolved.data?.source === "override" && !resolved.isError && <Button variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate({ provider, model: model.trim() }, { onError: fail })}>{t("pricing.resetBuiltin")}</Button>}</div>}
      {model.trim() && <div className="pricing-fields">{FIELDS.map((key) => <Field key={key} label={t(`pricing.field.${key}`)}>
        <input className="input" inputMode="decimal" value={draft[key]} placeholder={key === "input" || key === "output" ? "0" : t("pricing.sameAsInputOutput")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
      </Field>)}</div>}
    </div>
    <div className="modal-actions"><Button onClick={onClose}>{t("pricing.close")}</Button><Button variant="primary" disabled={!model.trim() || save.isPending || resolved.isError} onClick={submit}>{t(save.isPending ? "pricing.saving" : "pricing.save")}</Button></div>

    <h3 className="pricing-heading">{t("pricing.overrides")} {overrides.data && <Pill>{new Intl.NumberFormat(locale).format(overrides.data.overrides.length)}</Pill>}</h3>
    {overrides.isError ? <p className="text-danger"><code>{toProblem(overrides.error, language).code}</code> · {toProblem(overrides.error, language).message} <Button onClick={() => void overrides.refetch()}>{t("common.retry")}</Button></p>
      : <Table columns={[t("pricing.model"), t("pricing.in"), t("pricing.out"), t("pricing.cacheRead"), ""]} empty={t("pricing.noOverrides")}
        rows={(overrides.data?.overrides ?? []).map((row) => [<code>{row.provider}/{row.model}</code>, rate(row.input, locale), rate(row.output, locale), rate(row.cached, locale),
          <button className="button button-ghost" aria-label={t("pricing.resetAria", { name: `${row.provider}/${row.model}` })} onClick={() => reset.mutate({ provider: row.provider, model: row.model }, { onError: fail })}>{t("pricing.reset")}</button>])} />}
    {(overrides.data?.overrides.length ?? 0) > 0 && <div className="modal-actions"><Button variant="danger" disabled={reset.isPending} onClick={() => reset.mutate({}, { onSuccess: () => showToast({ tone: "success", localized: { key: "pricing.resetAllDone" } }), onError: fail })}>{t("pricing.resetAll")}</Button></div>}
  </Modal>;
}
