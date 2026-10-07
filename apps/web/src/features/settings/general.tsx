import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../shared/locale";
import { createFormatters, normalizeLanguage, type Message, type MessageKey } from "../../shared/i18n";
import { toProblem } from "../../shared/errors";
import { Button, CopyField, Field, Modal, PageHeading, Panel, StateBlock, Table, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { downloadSettingsFile, useRuntimeInfo, useSettingsImport, type SettingsPreview } from "./api";

const MAX_FILE_BYTES = 64 * 1024;

export function SettingsGeneral({ theme, onTheme }: { theme: string; onTheme: (theme: string) => void }) {
  const { language, setLanguage, t } = useLocale();
  const f = useMemo(() => createFormatters(language), [language]);
  const runtime = useRuntimeInfo();
  const imports = useSettingsImport();
  const showToast = useToast();
  const [document, setDocument] = useState<unknown>(null);
  const [review, setReview] = useState<SettingsPreview | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | { localized: Message; code: string } | null>(null);
  const problem = !failure ? null : "error" in failure ? toProblem(failure.error, language) : { code: failure.code, message: t(failure.localized.key, failure.localized.params) };
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const busy = reading || imports.preview.isPending || imports.apply.isPending;
  const fail = (error: unknown) => { setFailure({ error }); showToast({ tone: "error", error }); };
  const rejectFile = (key: MessageKey) => {
    const rejection = { code: "INVALID_REQUEST", localized: { key } };
    setFailure(rejection); showToast({ tone: "error", ...rejection });
  };

  const preview = (value: unknown) => {
    setReview(null); setFailure(null);
    imports.preview.mutate(value, { onSuccess: setReview, onError: fail });
  };
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setDocument(null); setReview(null); setFailure(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { rejectFile("settings.fileTooLarge"); return; }
    setReading(true);
    let value: unknown;
    try {
      value = JSON.parse(await file.text());
    } catch { rejectFile("settings.fileInvalid"); return; }
    finally { setReading(false); }
    setDocument(value); preview(value);
  };
  const download = async (kind: "export" | "runtime") => {
    setDownloading(true);
    try { await downloadSettingsFile(kind); }
    catch (error) { fail(error); }
    finally { setDownloading(false); }
  };
  const apply = () => {
    if (!review || typed !== "IMPORT") return;
    imports.apply.mutate({ document, expectedVersion: review.version }, {
      onSuccess: () => { setReview(null); setDocument(null); setConfirming(false); showToast({ tone: "success", localized: { key: "settings.importSucceeded" } }); },
      onError: (error) => { setReview(null); setConfirming(false); fail(error); },
    });
  };
  const data = runtime.data;

  return <><PageHeading eyebrow={t("settings.eyebrow")} title={t("settings.title")} description={t("settings.description")} />
    <div className="split"><Panel title={t("settings.runtime")} detail={t("settings.restart")} className="settings-runtime" action={<Button onClick={() => { void runtime.refetch(); }} disabled={runtime.isFetching}>{t("common.refresh")}</Button>}>
      {runtime.error ? <div className="state-block error"><code>{toProblem(runtime.error, language).code}</code><p>{toProblem(runtime.error, language).message}</p><Button onClick={() => { void runtime.refetch(); }}>{t("common.retry")}</Button></div>
        : !data ? <StateBlock state="loading" /> : <div className="stack">
          <CopyField label={t("settings.endpoint")} value={`${window.location.origin}/v1`} />
          <Table columns={[t("settings.setting"), t("settings.runningValue")]} rows={[
            [t("settings.bind"), <code>{data.bindAddress ?? t("settings.notListening")}</code>], [t("settings.port"), String(data.port ?? t("settings.notListening"))],
            [t("settings.dataDir"), <code>{data.dataDir}</code>], [t("settings.timezone"), data.usageTimezone],
            [t("settings.retention"), t("settings.days", { count: f.number(data.usageRetentionDays) })], [t("settings.dailyRetention"), t("settings.days", { count: f.number(data.dailyRetentionDays) })],
            [t("settings.idleTimeout"), t("settings.seconds", { count: f.number(data.streamIdleTimeoutMs / 1000) })],
            [t("settings.runtimeDb"), `${data.nodeVersion} / ${data.databaseDriver}`], [t("settings.uptime"), t("settings.minutes", { count: f.number(Math.floor(data.uptimeSeconds / 60)) })],
          ]} />
          <Button onClick={() => { void download("runtime"); }} disabled={downloading}>{t("settings.downloadRuntime")}</Button>
        </div>}
    </Panel><Panel title={t("settings.presentation")}>
      <div className="stack"><Field label={t("settings.theme")} hint={t("settings.browserHint")}><select className="input" value={theme} onChange={(event) => onTheme(event.target.value)}><option value="dark">{t("settings.dark")}</option><option value="light">{t("settings.light")}</option></select></Field>
        <Field label={t("settings.language")} hint={t("settings.languageHint")}><select className="input" value={language} onChange={event => setLanguage(normalizeLanguage(event.target.value))}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></Field>
        <p className="muted">{t("settings.languageScope")}</p>
        <Link to="/settings/auth" className="button">{t("settings.authLink")}</Link><Link to="/gateway/routing" className="button">{t("settings.routingLink")}</Link>
        <Link to="/gateway/token-saver" className="button">{t("settings.tokenSaverLink")}</Link><Link to="/network/proxy-pools" className="button">{t("settings.proxyLink")}</Link>
      </div>
    </Panel></div>
    <Panel title={t("settings.portable")} detail={t("settings.portableHint")} className="section-gap" action={<Button onClick={() => { void download("export"); }} disabled={downloading || busy}>{t("settings.export")}</Button>}>
      <p className="muted">{t("settings.exportWarning")}</p>
      <Field label={t("settings.importFile")} hint={t("settings.importHint")}><input className="input" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { void selectFile(event); }} /></Field>
      {problem && <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>}
      {imports.preview.isPending || reading ? <StateBlock state="loading" /> : review && <>
        <Table columns={[t("settings.setting"), t("settings.current"), t("settings.imported")]} rows={review.changes.map((change) => [<code>{change.key}</code>, String(change.before), String(change.after)])} empty={t("settings.matches")} />
        {review.changes.some((change) => (change.key === "requireLogin" || change.key === "requireApiKey") && change.after === false) && <Warning tone="danger">{t("settings.accessWarning")}</Warning>}
        <div className="modal-actions"><Button onClick={() => { setTyped(""); setConfirming(true); }} variant="primary" disabled={busy || review.changes.length === 0}>{t("settings.reviewApply")}</Button></div>
      </>}
      {document !== null && !review && !busy && <Button onClick={() => preview(document)}>{t("settings.previewAgain")}</Button>}
    </Panel>
    {confirming && review && <Modal title={t("settings.applyTitle")} onClose={() => { if (!imports.apply.isPending) setConfirming(false); }}>
      <p>{t("settings.importConfirm", { count: f.number(review.changes.length) })}</p>
      <input className="input" aria-label={t("settings.confirmAria")} autoComplete="off" value={typed} disabled={imports.apply.isPending} onChange={(event) => setTyped(event.target.value)} />
      <div className="modal-actions"><Button onClick={() => setConfirming(false)} disabled={imports.apply.isPending}>{t("common.cancel")}</Button><Button variant="primary" onClick={apply} disabled={typed !== "IMPORT" || imports.apply.isPending}>{t(imports.apply.isPending ? "settings.applying" : "settings.apply")}</Button></div>
    </Modal>}
  </>;
}
