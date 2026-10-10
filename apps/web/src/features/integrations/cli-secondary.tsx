import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../shared/api";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useToast } from "../../shared/toast";
import { Button, Field, PageHeading, Panel, Pill, StateBlock } from "../../shared/ui";
import {
  useApplyCopilotPreview, useApplyDroidPreview, useApplyGrokBuildPreview, useApplyHermesPreview,
  useApplyJcodePreview, useApplyKiloPreview, useApplyManagedJsonPreview, useApplyManagedTomlPreview,
  useApplyOmpPreview, useApplyOpenClawPreview, useCopilotPreview, useCopilotStatus, useDroidPreview,
  useDroidStatus, useGrokBuildPreview, useGrokBuildStatus, useHermesPreview, useHermesStatus,
  useJcodePreview, useJcodeStatus, useKiloPreview, useKiloStatus, useManagedJsonPreview,
  useManagedJsonStatus, useManagedTomlPreview, useManagedTomlStatus, useOmpPreview, useOmpStatus,
  useOpenClawPreview, useOpenClawStatus, type ManagedJsonTool, type ManagedTomlTool,
} from "./api";
import type { MessageKey } from "../../shared/i18n";

type PreviewSource = {
  previewId: string; action: "configure" | "reset"; diff: string[]; expiresAt: string;
  configPath?: string; authPath?: string; vscodePath?: string; envPath?: string; files?: string[];
};
type Review = { previewId: string; action: "configure" | "reset"; diff: string[]; expiresAt: string; target: string };
type Input = { action: "reset" } | { action: "configure"; baseUrl: string; apiKey: string; model: string; contextWindow: number; agentModels: Record<string, string> };
type Status = { installed: boolean; configured: boolean; agents?: { id: string; model: string }[] };
type DetailProps = {
  title: string; description: MessageKey; status?: Status; loading: boolean; error: unknown; retry: () => void;
  previewBusy: boolean; applyBusy: boolean; model?: "model" | "default" | "none"; contextWindow?: boolean;
  onPreview: (input: Input, done: (review: PreviewSource) => void, fail: (error: unknown) => void) => void;
  onApply: (id: string, done: (action: string) => void, fail: (error: unknown) => void) => void;
};

function targetOf(value: PreviewSource) {
  return (value.files?.length ? value.files : [value.authPath, value.vscodePath, value.configPath, value.envPath].filter((path): path is string => Boolean(path))).join(" · ");
}

function AdapterDetail({ title, description, status, loading, error, retry, previewBusy, applyBusy, model = "model", contextWindow = false, onPreview, onApply }: DetailProps) {
  const { language, t } = useLocale();
  const toast = useToast();
  const [baseUrl, setBaseUrl] = useState(`${window.location.origin}/v1`);
  const [apiKey, setApiKey] = useState("");
  const [modelValue, setModelValue] = useState("gpt-5-codex");
  const [contextValue, setContextValue] = useState("128000");
  const [agentModels, setAgentModels] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Review | null>(null);
  const actionRef = useRef(false);
  const busy = previewBusy || applyBusy;
  const problem = error ? toProblem(error, language) : null;
  const fail = (cause: unknown) => {
    if (cause instanceof ApiError && cause.code === "PREVIEW_LIMIT") toast({ tone: "error", code: cause.code, localized: { key: "cli.previewLimit" } });
    else toast({ tone: "error", error: cause });
  };
  const startPreview = (input: Input) => {
    if (busy || actionRef.current) return;
    actionRef.current = true;
    setReview(null);
    onPreview(input, (value) => {
      actionRef.current = false;
      setReview({ previewId: value.previewId, action: value.action, diff: value.diff, expiresAt: value.expiresAt, target: targetOf(value) });
    }, (cause) => { actionRef.current = false; fail(cause); });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startPreview({ action: "configure", baseUrl, apiKey, model: modelValue, contextWindow: Number(contextValue), agentModels });
  };
  const apply = () => {
    if (!review || busy || actionRef.current || review.diff.length === 0) return;
    actionRef.current = true;
    onApply(review.previewId, (action) => {
      actionRef.current = false;
      setReview(null);
      setApiKey("");
      toast({ tone: "success", localized: { key: action === "reset" ? "cli.resetDone" : "cli.applyDone", params: { tool: title } } });
    }, (cause) => {
      actionRef.current = false;
      if (cause instanceof ApiError && (cause.code === "PREVIEW_EXPIRED" || cause.code === "CONFIG_CHANGED")) {
        setReview(null);
        toast({ tone: "error", code: cause.code, localized: { key: "cli.reviewAgain" } });
      } else fail(cause);
    });
  };
  const expiry = review ? new Date(review.expiresAt) : null;
  return <><PageHeading eyebrow={t("cli.detailEyebrow", { tool: title })} title={title} description={t(description, { tool: title })} action={status && <Pill tone={status.configured ? "healthy" : status.installed ? "info" : "muted"}>{t(status.configured ? "cli.aigateConfigured" : status.installed ? "cli.available" : "cli.notDetected")}</Pill>} />
    {loading ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("common.loadFailed")}</strong><p>{problem.message}</p><Button onClick={retry}>{t("common.retry")}</Button></div> : status && <>
      <form className="stack section-gap" onSubmit={submit}>
        <Field label={t("cli.baseUrl")}><input className="input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required /></Field>
        <Field label={t("cli.apiKey")}><input className="input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} minLength={8} maxLength={4096} required /></Field>
        {model !== "none" && <Field label={t(model === "default" ? "cli.defaultModel" : "cli.model")}><input className="input" value={modelValue} onChange={(event) => setModelValue(event.target.value)} maxLength={256} required /></Field>}
        {contextWindow && <Field label={t("cli.contextWindow")}><input className="input" type="number" min="1" max="10000000" value={contextValue} onChange={(event) => setContextValue(event.target.value)} required /></Field>}
        {status.agents?.map((agent) => <Field key={agent.id} label={t("cli.agent", { id: agent.id })} hint={agent.model ? t("cli.agentCurrent", { model: agent.model }) : t("cli.agentDefault")}><input className="input" value={agentModels[agent.id] ?? ""} onChange={(event) => setAgentModels({ ...agentModels, [agent.id]: event.target.value })} maxLength={256} /></Field>)}
        <Button type="submit" variant="primary" disabled={busy}>{previewBusy ? t("cli.preparing") : t("cli.previewConfig")}</Button>
      </form>
      {status.configured && <div className="section-gap"><Button variant="danger" disabled={busy} onClick={() => startPreview({ action: "reset" })}>{t("cli.previewReset")}</Button></div>}
      {review && <Panel title={t(review.action === "reset" ? "cli.reviewReset" : "cli.reviewConfig")} detail={review.target} className="section-gap"><div className="stack"><pre className="code-block">{review.diff.map((line, index) => <div className={line.startsWith("+") ? "text-healthy" : line.startsWith("-") ? "text-danger" : "muted"} key={`${index}:${line}`}>{line}</div>)}{review.diff.length === 0 && t("cli.noChanges")}</pre><p className="muted">{t("cli.redactedExpiry", { time: expiry && Number.isFinite(expiry.getTime()) ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { timeStyle: "medium" }).format(expiry) : t("cli.unknownExpiry") })}</p><div className="row"><Button disabled={busy} onClick={() => setReview(null)}>{t("common.cancel")}</Button><Button variant="primary" disabled={busy || review.diff.length === 0} onClick={apply}>{applyBusy ? t("cli.applying") : t("cli.applyReviewed")}</Button></div></div></Panel>}
    </>}
  </>;
}

const plainInput = (input: Input) => input.action === "reset" ? input : { action: "configure" as const, baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model };
const resultAction = (result: { action: string }) => result.action;

export function DroidToolDetail() {
  const status = useDroidStatus(), preview = useDroidPreview(), apply = useApplyDroidPreview();
  return <AdapterDetail title="Droid" description="cli.droidDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function CopilotToolDetail() {
  const status = useCopilotStatus(), preview = useCopilotPreview(), apply = useApplyCopilotPreview();
  return <AdapterDetail title="GitHub Copilot" description="cli.copilotDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function ManagedJsonToolDetail({ tool, title }: { tool: ManagedJsonTool; title: string }) {
  const status = useManagedJsonStatus(tool), preview = useManagedJsonPreview(tool), apply = useApplyManagedJsonPreview(tool);
  return <AdapterDetail title={title} description="cli.genericDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function ManagedTomlToolDetail({ tool, title }: { tool: ManagedTomlTool; title: string }) {
  const status = useManagedTomlStatus(tool), preview = useManagedTomlPreview(tool), apply = useApplyManagedTomlPreview(tool);
  return <AdapterDetail title={title} description="cli.genericDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function KiloToolDetail() {
  const status = useKiloStatus(), preview = useKiloPreview(), apply = useApplyKiloPreview();
  return <AdapterDetail title="Kilo Code" description="cli.kiloDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function HermesToolDetail() {
  const status = useHermesStatus(), preview = useHermesPreview(), apply = useApplyHermesPreview();
  return <AdapterDetail title="Hermes Agent" description="cli.hermesDescription" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function JcodeToolDetail() {
  const status = useJcodeStatus(), preview = useJcodePreview(), apply = useApplyJcodePreview();
  return <AdapterDetail title="JCode" description="cli.jcodeDescription" model="default" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(plainInput(input), { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function OmpToolDetail() {
  const status = useOmpStatus(), preview = useOmpPreview(), apply = useApplyOmpPreview();
  return <AdapterDetail title="Oh My Pi" description="cli.ompDescription" model="none" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey }, { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function GrokBuildToolDetail() {
  const status = useGrokBuildStatus(), preview = useGrokBuildPreview(), apply = useApplyGrokBuildPreview();
  return <AdapterDetail title="Grok Build" description="cli.grokBuildDescription" contextWindow status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model, contextWindow: input.contextWindow }, { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
export function OpenClawToolDetail() {
  const status = useOpenClawStatus(), preview = useOpenClawPreview(), apply = useApplyOpenClawPreview();
  return <AdapterDetail title="OpenClaw" description="cli.openClawDescription" model="default" status={status.data} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model, agentModels: input.agentModels }, { onSuccess: done, onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(resultAction(value)), onError: fail })} />;
}
