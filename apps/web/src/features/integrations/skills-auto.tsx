import { useState, type FormEvent } from "react";
import { Button, Field, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { useToast } from "../../shared/toast";
import { usePatchSettings, useSettings, type Settings } from "../settings/api";
import { useSkillPreview } from "./api";

const MIN_BUDGET = 1000;
const MAX_BUDGET = 32_000;
const MAX_TEST_CHARS = 16_384;

// docs/contracts/skills.md, "Automatic skills": the settings over the existing settings API, and a local scoring test.
export function AutoSkillsPanels() {
  const { language, t } = useLocale();
  const settings = useSettings();
  const save = usePatchSettings();
  const preview = useSkillPreview();
  const toast = useToast();
  const [budget, setBudget] = useState<string | null>(null);
  const [text, setText] = useState("");
  const number = (value: number) => new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 3 }).format(value);
  const readError = (error: unknown, retry: () => void) => { const problem = toProblem(error, language); return <div className="state-block error"><code>{problem.code}</code><strong>{t("common.loadFailed")}</strong><p>{problem.message}</p><Button onClick={retry}>{t("common.retry")}</Button></div>; };
  const patch = (fields: Partial<Settings>) => save.mutate(fields, { onError: (error) => toast({ tone: "error", error }) });
  const commitBudget = (current: number) => {
    if (budget === null) return;
    const value = Number(budget);
    if (!Number.isInteger(value) || value < MIN_BUDGET || value > MAX_BUDGET) { toast({ tone: "error", localized: { key: "skills.budgetInvalid", params: { min: number(MIN_BUDGET), max: number(MAX_BUDGET) } } }); return; }
    setBudget(null);
    if (value !== current) patch({ skillsBudgetChars: value });
  };
  const test = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!preview.isPending && text.trim()) preview.mutate(text); };
  const toggle = (label: string, detail: string, checked: boolean, field: "skillsAutoEnabled" | "skillsCatalogEnabled") =>
    <div className="list-row"><div><strong>{label}</strong><small>{detail}</small></div>
      <input type="checkbox" checked={checked} disabled={save.isPending} aria-label={label} onChange={(event) => patch({ [field]: event.target.checked })} /></div>;

  const config = settings.data;
  return <>
    <Panel title={t("skills.autoTitle")} detail={t("skills.autoDetail")} className="section-gap"
      action={config ? <Pill tone={config.skillsAutoEnabled ? "healthy" : "muted"}>{t(config.skillsAutoEnabled ? "skills.enabledState" : "skills.disabledState")}</Pill> : undefined}>
      {settings.isPending ? <StateBlock state="loading" /> : settings.isError || !config ? readError(settings.error, () => void settings.refetch()) : <div className="stack">
        {toggle(t("skills.autoEnabled"), t("skills.autoEnabledDetail"), config.skillsAutoEnabled, "skillsAutoEnabled")}
        <div className="list-row"><div><strong>{t("skills.selection")}</strong><small>{t("skills.selectionDetail")}</small></div>
          <select className="input" aria-label={t("skills.selection")} value={config.skillsSelection} disabled={save.isPending}
            onChange={(event) => patch({ skillsSelection: event.target.value === "lexical" ? "lexical" : "hybrid" })}>
            <option value="hybrid">{t("skills.selectionHybrid")}</option><option value="lexical">{t("skills.selectionLexical")}</option></select></div>
        {toggle(t("skills.catalogEnabled"), t("skills.catalogDetail"), config.skillsCatalogEnabled, "skillsCatalogEnabled")}
        <div className="list-row"><strong>{t("skills.maxSelected")}</strong><select className="input" aria-label={t("skills.maxSelected")} value={config.skillsMaxSelected} disabled={save.isPending}
          onChange={(event) => patch({ skillsMaxSelected: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
        <Field label={t("skills.budget")} hint={t("skills.budgetHint", { min: number(MIN_BUDGET), max: number(MAX_BUDGET) })}>
          <input className="input" type="number" min={MIN_BUDGET} max={MAX_BUDGET} step={500} value={budget ?? String(config.skillsBudgetChars)} disabled={save.isPending}
            onChange={(event) => setBudget(event.target.value)} onBlur={() => commitBudget(config.skillsBudgetChars)} onKeyDown={(event) => { if (event.key === "Enter") commitBudget(config.skillsBudgetChars); }} /></Field>
        <p className="muted">{t("skills.optOutHint")} <code>x-aigate-skills: off</code></p>
        <Warning>{t("skills.autoWarning")}</Warning>
      </div>}
    </Panel>
    <Panel title={t("skills.testTitle")} detail={t("skills.testDetail")} className="section-gap">
      <form className="stack" onSubmit={test}>
        <Field label={t("skills.testLabel")}><textarea className="input" rows={4} maxLength={MAX_TEST_CHARS} value={text} placeholder={t("skills.testPlaceholder")} onChange={(event) => setText(event.target.value)} /></Field>
        <div className="modal-actions"><Button type="submit" variant="primary" disabled={preview.isPending || !text.trim()}>{preview.isPending ? t("skills.testRunning") : t("skills.testRun")}</Button></div>
      </form>
      {preview.isError && readError(preview.error, () => preview.mutate(text))}
      {preview.data && <div className="stack section-gap">
        {preview.data.always.length > 0 && <p><strong>{t("skills.testAlways")}</strong> {preview.data.always.map((item) => item.name).join(", ")}</p>}
        {preview.data.selected.length
          ? <p><strong>{t("skills.testSelected")}</strong> {preview.data.selected.map((item) => item.name).join(", ")}</p>
          : !preview.data.always.length && <p className="muted">{t("skills.testNone")}</p>}
        {preview.data.candidates.length > 0 && <Table columns={[t("skills.columnSkill"), t("skills.testScore"), t("skills.columnState")]} rows={preview.data.candidates.map((item) => [
          <strong>{item.name}</strong>, number(item.score),
          <Pill tone={preview.data.selected.some((chosen) => chosen.id === item.id) ? "healthy" : "muted"}>{t(preview.data.selected.some((chosen) => chosen.id === item.id) ? "skills.testChosen" : "skills.testSkipped")}</Pill>,
        ])} />}
        {preview.data.hybrid && <>
          <h4>{t("skills.testHybridHeading")}</h4>
          <p><strong>{t("skills.testPreloaded")}</strong> {preview.data.hybrid.preloaded.length ? preview.data.hybrid.preloaded.map((item) => item.name).join(", ") : "—"}</p>
          <p><strong>{t("skills.testLoadable")}</strong> {preview.data.hybrid.loadable.length ? preview.data.hybrid.loadable.join(", ") : "—"}</p>
          {preview.data.hybrid.block && <><p className="muted">{t("skills.testChars", { count: number(preview.data.hybrid.chars) })}</p><pre className="code-block">{preview.data.hybrid.block}</pre></>}
          <h4>{t("skills.testLexicalHeading")}</h4>
        </>}
        {preview.data.block && <><p className="muted">{t("skills.testChars", { count: number(preview.data.chars) })}</p><pre className="code-block">{preview.data.block}</pre></>}
      </div>}
    </Panel>
  </>;
}
