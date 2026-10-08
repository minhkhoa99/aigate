import { useMemo, useState, type ReactNode } from "react";
import { toProblem } from "../../shared/errors";
import { createFormatters, type MessageKey } from "../../shared/i18n";
import { useLocale } from "../../shared/locale";
import { Button, Field, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useRoutingSimulation } from "./api";
import { reasonMessageKey, validateSimulationResult, warningMessageKey, type DecisionNode, type SimulationResult } from "./simulation-result";

const EXAMPLE = JSON.stringify({ model: "openai/gpt-4.1", messages: [{ role: "user", content: "Hello" }] }, null, 2);
const OUTCOME: Record<SimulationResult["outcome"], MessageKey> = { candidate: "simulator.outcomeCandidate", blocked: "simulator.outcomeBlocked", conditional: "simulator.outcomeConditional", inconclusive: "simulator.outcomeInconclusive" };
const STATUS: Record<DecisionNode["status"], MessageKey> = { candidate: "simulator.statusCandidate", fallback: "simulator.statusFallback", blocked: "simulator.statusBlocked", conditional: "simulator.statusConditional", unknown: "simulator.statusUnknown" };
const KIND: Record<DecisionNode["kind"], MessageKey> = { request: "simulator.kindRequest", combo: "simulator.kindCombo", capacity: "simulator.kindCapacity", model: "simulator.kindModel", account: "simulator.kindAccount", judge: "simulator.kindJudge" };

export function SimulationResultView({ result, stale }: { result: SimulationResult; stale: boolean }) {
  const { t, language } = useLocale();
  const f = useMemo(() => createFormatters(language), [language]);
  const inspected = useMemo(() => {
    try { return { children: validateSimulationResult(result) }; }
    catch (error) { return { error }; }
  }, [result]);
  if (!inspected.children) { const problem = toProblem(inspected.error, language); return <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>; }
  const children = inspected.children;
  const branches = (parentId: number | null): ReactNode => <ul className="simulation-tree">{(children.get(parentId) ?? []).map(node => <li key={node.id}>
    <details open={node.kind === "request"}><summary><span>{t(KIND[node.kind])} {node.order !== undefined && <span>{f.number(node.order)}</span>}</span>
      <code>{node.model ?? node.connectionId ?? node.provider}</code><Pill tone={node.status === "blocked" ? "danger" : node.status === "candidate" ? "info" : "warning"}>{t(STATUS[node.status])}</Pill></summary>
      <div className="stack simulation-node"><p>{t(reasonMessageKey(node.reason))} {reasonMessageKey(node.reason) === "simulator.reasonUnknown" && <code>{node.reason}</code>}</p>
        <div className="row wrap">{node.provider && <span>{t("simulator.provider")}: <code>{node.provider}</code></span>}
          {node.connectionId && <span>{t("simulator.account")}: <code>{node.connectionId}</code></span>}
          {node.priority !== undefined && <span>{t("simulator.priority")}: {f.number(node.priority)}</span>}
          {node.strategy && <span>{t("simulator.strategy")}: <code>{node.strategy}</code></span>}
          {node.errorCode && <code>{node.errorCode}</code>}</div>
        {node.lockUntil && <p>{t("simulator.lockUntil", { time: f.dateTime(Date.parse(node.lockUntil)) })}</p>}
        {!!node.missingCapabilities?.length && <p>{t("simulator.missing")}: <code>{node.missingCapabilities.join(", ")}</code></p>}
        {!!node.trimmedMessages && <p>{t("simulator.trimmed", { count: f.number(node.trimmedMessages) })}</p>}
        {node.fusion && <p>{t("simulator.fusionTuning", { count: f.number(node.fusion.minPanel), grace: f.number(node.fusion.stragglerGraceMs), timeout: f.number(node.fusion.panelTimeoutMs), concurrency: f.number(node.fusion.concurrency) })}</p>}
        {children.has(node.id) && branches(node.id)}
      </div>
    </details>
  </li>)}</ul>;
  return <Panel title={t("simulator.result")} detail={t("simulator.observed", { time: f.dateTime(Date.parse(result.observedAt)) })} className="simulation-result">
    <div className="stack">{stale && <Warning>{t("simulator.stale")}</Warning>}
      <strong>{t(OUTCOME[result.outcome])}</strong>
      <p>{t("simulator.required")}: <code>{result.requiredCapabilities.length ? result.requiredCapabilities.join(", ") : t("simulator.none")}</code></p>
      {result.warnings.map(warning => <Warning key={warning}>{t(warningMessageKey(warning))} {warningMessageKey(warning) === "simulator.warningUnknown" && <code>{warning}</code>}</Warning>)}
      {branches(null)}
    </div>
  </Panel>;
}

export function RoutingSimulatorTab() {
  const { t, language } = useLocale();
  const simulation = useRoutingSimulation();
  const [draft, setDraft] = useState(EXAMPLE);
  const [tokenSaverOptOut, setTokenSaverOptOut] = useState(false);
  const [submitted, setSubmitted] = useState<{ text: string; optOut: boolean } | null>(null);
  const [localFailure, setLocalFailure] = useState<"invalidJson" | "tooLarge" | null>(null);
  const error = simulation.error ? toProblem(simulation.error, language) : null;
  const stale = submitted !== null && (submitted.text !== draft || submitted.optOut !== tokenSaverOptOut);
  const run = () => {
    if (simulation.isPending) return;
    simulation.reset(); setLocalFailure(null);
    let request: unknown;
    try { request = JSON.parse(draft); } catch { setLocalFailure("invalidJson"); return; }
    const body = { request, tokenSaverOptOut };
    if (new TextEncoder().encode(JSON.stringify(body)).length > 65536) { setLocalFailure("tooLarge"); return; }
    setSubmitted({ text: draft, optOut: tokenSaverOptOut });
    simulation.mutate(body);
  };
  return <div className="stack section-gap simulation">
    <Panel title={t("simulator.title")} detail={t("simulator.description")}>
      <form className="stack" onSubmit={event => { event.preventDefault(); run(); }}>
        <Field label={t("simulator.input")} hint={t("simulator.inputHint")}><textarea className="input mono" rows={12} maxLength={65536} spellCheck={false} autoComplete="off" value={draft} onChange={event => setDraft(event.target.value)} /></Field>
        <label className="row"><input type="checkbox" checked={tokenSaverOptOut} onChange={event => setTokenSaverOptOut(event.target.checked)} />{t("simulator.optOut")}</label>
        <div className="row wrap"><Button type="submit" variant="primary" disabled={simulation.isPending}>{t(simulation.isPending ? "simulator.running" : "simulator.run")}</Button>
          <Button disabled={simulation.isPending} onClick={() => { setDraft(EXAMPLE); setLocalFailure(null); }}>{t("simulator.example")}</Button></div>
        {localFailure && <Warning tone="danger"><code>INVALID_REQUEST</code> · {t(localFailure === "invalidJson" ? "simulator.invalidJson" : "simulator.tooLarge")}</Warning>}
        {error && <Warning tone="danger"><code>{error.code}</code> · {error.message} <Button onClick={run}>{t("common.retry")}</Button></Warning>}
      </form>
    </Panel>
    {simulation.isPending ? <StateBlock state="loading" /> : simulation.data ? <SimulationResultView result={simulation.data} stale={stale} />
      : !error && !localFailure && <p className="muted">{t("simulator.empty")}</p>}
  </div>;
}
