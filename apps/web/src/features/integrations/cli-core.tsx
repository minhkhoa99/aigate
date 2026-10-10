import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ApiError } from "../../shared/api";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useToast } from "../../shared/toast";
import { Button, CopyField, Field, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useApplyClaudePreview, useApplyClinePreview, useApplyCodexPreview, useApplyOpenCodePreview, useClaudePreview, useClaudeStatus, useClinePreview, useClineStatus, useCliTools, useCodexPreview, useCodexStatus, useOpenCodePreview, useOpenCodeStatus, type ClaudePreview, type ClinePreview, type CodexPreview, type OpenCodePreview } from "./api";

const configurationRoutes = {
  claude: "/integrations/cli-tools/claude", codex: "/integrations/cli-tools/codex", opencode: "/integrations/cli-tools/opencode", cline: "/integrations/cli-tools/cline", droid: "/integrations/cli-tools/droid", copilot: "/integrations/cli-tools/copilot", crush: "/integrations/cli-tools/crush", pi: "/integrations/cli-tools/pi", smelt: "/integrations/cli-tools/smelt", codewhale: "/integrations/cli-tools/codewhale", forge: "/integrations/cli-tools/forge", kilo: "/integrations/cli-tools/kilo", openclaw: "/integrations/cli-tools/openclaw", "deepseek-tui": "/integrations/cli-tools/deepseek-tui", hermes: "/integrations/cli-tools/hermes", jcode: "/integrations/cli-tools/jcode", omp: "/integrations/cli-tools/omp", "grok-build": "/integrations/cli-tools/grok-build",
} as const;
function toolRoute(id: string) { return Object.entries(configurationRoutes).find(([key]) => key === id)?.[1] ?? null; }

export function CliTools() {
  const { language, t } = useLocale();
  const query = useCliTools();
  const problem = query.error ? toProblem(query.error, language) : null;
  return <><PageHeading eyebrow={t("cli.eyebrow")} title={t("cli.title")} description={t("cli.description")} />
    <Warning>{t("cli.discoveryWarning")}</Warning>
    {query.isPending ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("cli.readFailed")}</strong><p>{problem.message}</p><Button onClick={() => void query.refetch()}>{t("common.retry")}</Button></div>
      : <div className="grid grid-3 section-gap">{(query.data ?? []).map((tool) => { const route = toolRoute(tool.id); const card = <article className="tool-card"><div className="row between"><span className="tool-glyph">⌘</span><Pill tone={tool.status === "configured" ? "healthy" : tool.status === "available" ? "info" : "muted"}>{t(tool.status === "configured" ? "cli.configFound" : tool.status === "available" ? "cli.installed" : "cli.notDetected")}</Pill></div><strong>{tool.name}</strong><small>{t(tool.installed ? "cli.commandFound" : "cli.commandMissing")}</small>{tool.configPath && <small className="mono">{tool.configPath}</small>}{route && <small className="tool-link">{t("cli.reviewLink")}</small>}</article>; return route ? <Link className="tool-card-link" key={tool.id} to={route}>{card}</Link> : <div key={tool.id}>{card}</div>; })}</div>}
  </>;
}

type ToolKind = "claude" | "codex" | "opencode" | "cline";
type Preview = { previewId: string; action: "configure" | "reset"; diff: string[]; expiresAt: string; target: string };
type Input = { action: "reset" } | { action: "configure"; baseUrl: string; apiKey: string; model: string; subagentModel: string };
type Status = { installed: boolean; configured: boolean; paths: { label: "cli.path" | "cli.state" | "cli.secret"; value: string }[]; current?: string | null };
type DetailProps = {
  kind: ToolKind; status: Status | null; loading: boolean; error: unknown; retry: () => void;
  previewBusy: boolean; applyBusy: boolean;
  onPreview: (input: Input, done: (preview: Preview) => void, fail: (error: unknown) => void) => void;
  onApply: (id: string, done: (action: "configure" | "reset") => void, fail: (error: unknown) => void) => void;
};
const toolCopy = {
  claude: { name: "Claude Code", description: "cli.claudeDescription", keyHint: "cli.claudeKeyHint", warning: "cli.singleFileWarning" },
  codex: { name: "Codex", description: "cli.codexDescription", keyHint: "cli.codexKeyHint", warning: "cli.codexWarning" },
  opencode: { name: "OpenCode", description: "cli.openCodeDescription", keyHint: "cli.openCodeKeyHint", warning: "cli.singleFileWarning" },
  cline: { name: "Cline", description: "cli.clineDescription", keyHint: "cli.clineKeyHint", warning: "cli.clineWarning" },
} as const;

function CoreDetail({ kind, status, loading, error, retry, previewBusy, applyBusy, onPreview, onApply }: DetailProps) {
  const { language, t } = useLocale();
  const toast = useToast();
  const [baseUrl, setBaseUrl] = useState(`${window.location.origin}/v1`);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5-codex");
  const [subagentModel, setSubagentModel] = useState("");
  const [review, setReview] = useState<Preview | null>(null);
  const busy = previewBusy || applyBusy;
  const copy = toolCopy[kind];
  const problem = error ? toProblem(error, language) : null;
  const fail = (cause: unknown) => {
    if (cause instanceof ApiError && cause.code === "PREVIEW_LIMIT") toast({ tone: "error", code: cause.code, localized: { key: "cli.previewLimit" } });
    else toast({ tone: "error", error: cause });
  };
  const startPreview = (input: Input) => {
    if (busy) return;
    setReview(null);
    onPreview(input, setReview, fail);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startPreview({ action: "configure", baseUrl, apiKey, model, subagentModel });
  };
  const apply = () => {
    if (!review || busy || review.diff.length === 0) return;
    onApply(review.previewId, (action) => {
      setReview(null);
      setApiKey("");
      toast({ tone: "success", localized: { key: action === "reset" ? "cli.resetDone" : "cli.applyDone", params: { tool: copy.name } } });
    }, (cause) => {
      if (cause instanceof ApiError && (cause.code === "PREVIEW_EXPIRED" || cause.code === "CONFIG_CHANGED")) {
        setReview(null);
        toast({ tone: "error", code: cause.code, localized: { key: "cli.reviewAgain" } });
      } else fail(cause);
    });
  };
  const current = status?.current;
  const expiry = review ? new Date(review.expiresAt) : null;
  return <><PageHeading eyebrow={t("cli.detailEyebrow", { tool: copy.name })} title={copy.name} description={t(copy.description)} action={status && <Pill tone={status.configured ? "healthy" : status.installed ? "info" : "muted"}>{t(status.configured ? "cli.aigateConfigured" : status.installed ? "cli.available" : "cli.notDetected")}</Pill>} />
    {loading ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("common.loadFailed")}</strong><p>{problem.message}</p><Button onClick={retry}>{t("common.retry")}</Button></div> : status && <>
      <div className="split section-gap"><Panel title={t("cli.connection")}><form className="stack" onSubmit={submit}>
        <Field label={t("cli.baseUrl")}><input className="input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required /></Field>
        <Field label={t("cli.apiKey")} hint={t(copy.keyHint)}><input className="input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} minLength={8} maxLength={4096} required /></Field>
        {kind !== "claude" && <Field label={t(kind === "codex" ? "cli.defaultModel" : "cli.model")}><input className="input" value={model} onChange={(event) => setModel(event.target.value)} maxLength={256} required /></Field>}
        {kind === "codex" && <Field label={t("cli.subagentModel")}><input className="input" value={subagentModel} onChange={(event) => setSubagentModel(event.target.value)} maxLength={256} /></Field>}
        <Button type="submit" variant="primary" disabled={busy}>{previewBusy ? t("cli.preparing") : t("cli.previewConfig")}</Button>
      </form></Panel><Panel title={t(kind === "cline" ? "cli.localFiles" : "cli.localFile")}><div className="stack">{status.paths.map((path) => <CopyField key={path.label} label={t(path.label)} value={path.value} />)}<Warning>{t(copy.warning)}</Warning>{kind !== "cline" && <Pill tone={status.configured ? "healthy" : "muted"}>{current ? t(kind === "claude" ? "cli.currentEndpoint" : "cli.currentModel", { value: current }) : t(kind === "claude" ? "cli.noEndpoint" : "cli.noModel")}</Pill>}</div></Panel></div>
      {status.configured && <div className="section-gap"><Button variant="danger" disabled={busy} onClick={() => startPreview({ action: "reset" })}>{t("cli.previewReset")}</Button></div>}
      {review && <Panel title={t(review.action === "reset" ? "cli.reviewReset" : "cli.reviewConfig")} detail={t("cli.target", { path: review.target })} className="section-gap"><div className="stack"><pre className="code-block">{review.diff.map((line, index) => <div className={line.startsWith("+") ? "text-healthy" : line.startsWith("-") ? "text-danger" : "muted"} key={`${index}:${line}`}>{line}</div>)}{review.diff.length === 0 && t("cli.noChanges")}</pre><p className="muted">{t("cli.redactedExpiry", { time: expiry && Number.isFinite(expiry.getTime()) ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { timeStyle: "medium" }).format(expiry) : t("cli.unknownExpiry") })}</p><div className="row"><Button disabled={busy} onClick={() => setReview(null)}>{t("common.cancel")}</Button><Button variant="primary" disabled={busy || review.diff.length === 0} onClick={apply}>{applyBusy ? t("cli.applying") : t("cli.applyReviewed")}</Button></div></div></Panel>}
    </>}
  </>;
}

const singlePreview = (value: ClaudePreview | CodexPreview | OpenCodePreview): Preview => ({ previewId: value.previewId, action: value.action, diff: value.diff, expiresAt: value.expiresAt, target: value.configPath });
const clinePreview = (value: ClinePreview): Preview => ({ previewId: value.previewId, action: value.action, diff: value.diff, expiresAt: value.expiresAt, target: `${value.statePath} · ${value.secretsPath}` });

export function ClaudeToolDetail() {
  const status = useClaudeStatus(), preview = useClaudePreview(), apply = useApplyClaudePreview();
  return <CoreDetail kind="claude" status={status.data ? { installed: status.data.installed, configured: status.data.configured, paths: [{ label: "cli.path", value: status.data.configPath }], current: status.data.baseUrl } : null} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey }, { onSuccess: (value) => done(singlePreview(value)), onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(value.action === "reset" ? "reset" : "configure"), onError: fail })} />;
}
export function OpenCodeToolDetail() {
  const status = useOpenCodeStatus(), preview = useOpenCodePreview(), apply = useApplyOpenCodePreview();
  return <CoreDetail kind="opencode" status={status.data ? { installed: status.data.installed, configured: status.data.configured, paths: [{ label: "cli.path", value: status.data.configPath }], current: status.data.model } : null} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model }, { onSuccess: (value) => done(singlePreview(value)), onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(value.action === "reset" ? "reset" : "configure"), onError: fail })} />;
}
export function ClineToolDetail() {
  const status = useClineStatus(), preview = useClinePreview(), apply = useApplyClinePreview();
  return <CoreDetail kind="cline" status={status.data ? { installed: status.data.installed, configured: status.data.configured, paths: [{ label: "cli.state", value: status.data.statePath }, { label: "cli.secret", value: status.data.secretsPath }] } : null} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model }, { onSuccess: (value) => done(clinePreview(value)), onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(value.action === "reset" ? "reset" : "configure"), onError: fail })} />;
}
export function CliToolDetail() {
  const status = useCodexStatus(), preview = useCodexPreview(), apply = useApplyCodexPreview();
  return <CoreDetail kind="codex" status={status.data ? { installed: status.data.installed, configured: status.data.configured, paths: [{ label: "cli.path", value: status.data.configPath }], current: status.data.model } : null} loading={status.isPending} error={status.error} retry={() => void status.refetch()} previewBusy={preview.isPending} applyBusy={apply.isPending}
    onPreview={(input, done, fail) => preview.mutate(input.action === "reset" ? input : { action: "configure", baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model, subagentModel: input.subagentModel }, { onSuccess: (value) => done(singlePreview(value)), onError: fail })}
    onApply={(id, done, fail) => apply.mutate(id, { onSuccess: (value) => done(value.action === "reset" ? "reset" : "configure"), onError: fail })} />;
}
