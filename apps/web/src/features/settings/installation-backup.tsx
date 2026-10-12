import { useState, type ChangeEvent } from "react";
import { useLocale } from "../../shared/locale";
import { ApiError, api } from "../../shared/api";
import { toProblem } from "../../shared/errors";
import { Button, Field, Input, Panel, StateBlock, Table, Warning } from "../../shared/ui";
import { Modal } from "../../shared/dialog";

const MAX_FILE_BYTES = 180 * 1024 * 1024;
interface BackupPreview { expectedVersion: string; createdAt: string; databaseBytes: number; files: string[]; encrypted: true; restartRequired: true }

export function InstallationBackup() {
  const { language, t } = useLocale();
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [backupDocument, setDocument] = useState<unknown>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [busy, setBusy] = useState<"export" | "read" | "preview" | "apply" | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [staged, setStaged] = useState(false);
  const problem = failure ? toProblem(failure, language) : null;
  const ready = password.length > 0 && passphrase.length >= 12 && passphrase.length <= 1024;
  const fail = (error: unknown) => { setFailure(error); setPreview(null); };
  const credentials = () => ({ password, passphrase });

  const exportBackup = async () => {
    if (!ready || busy) return;
    setFailure(null); setBusy("export");
    try {
      const value = await api<unknown>("/api/settings/backup/export", { method: "POST", body: credentials(), timeoutMs: 120_000 });
      const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "aigate-installation-backup.json";
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); URL.revokeObjectURL(url); }
      setPassword(""); setPassphrase("");
    } catch (error) { fail(error); }
    finally { setBusy(null); }
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    setDocument(null); setPreview(null); setFailure(null); setStaged(false);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setFailure(new ApiError(413, "BACKUP_TOO_LARGE", t("backup.fileTooLarge"))); return; }
    setBusy("read");
    try { setDocument(JSON.parse(await file.text())); }
    catch { setFailure(new ApiError(400, "BACKUP_INVALID", t("backup.fileInvalid"))); }
    finally { setBusy(null); }
  };

  const review = async () => {
    if (!ready || backupDocument === null || busy) return;
    setFailure(null); setPreview(null); setBusy("preview");
    try { setPreview(await api<BackupPreview>("/api/settings/backup/preview", { method: "POST", body: { ...credentials(), document: backupDocument }, timeoutMs: 120_000 })); }
    catch (error) { fail(error); }
    finally { setBusy(null); }
  };

  const apply = async () => {
    if (!preview || typed !== "RESTORE" || busy) return;
    setBusy("apply"); setFailure(null);
    try {
      await api<{ staged: true; restartRequired: true }>("/api/settings/backup/apply", { method: "POST",
        body: { ...credentials(), document: backupDocument, expectedVersion: preview.expectedVersion, confirmation: typed }, timeoutMs: 120_000 });
      setStaged(true); setDocument(null); setPreview(null); setPassword(""); setPassphrase(""); setTyped(""); setConfirming(false);
    } catch (error) { fail(error); setConfirming(false); }
    finally { setBusy(null); }
  };

  return <><Panel title={t("backup.title")} detail={t("backup.hint")} className="section-gap">
    <div className="stack">
      <Warning tone="danger">{t("backup.warning")}</Warning>
      <Field label={t("backup.password")}><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>
      <Field label={t("backup.passphrase")} hint={t("backup.passphraseHint")}><Input type="password" autoComplete="new-password" value={passphrase} onChange={event => setPassphrase(event.target.value)} /></Field>
      <Button onClick={() => { void exportBackup(); }} disabled={!ready || busy !== null}>{t("backup.export")}</Button>
      <Field label={t("backup.importFile")} hint={t("backup.importHint")}><input className="input" type="file" accept=".json,application/json" disabled={busy !== null} onChange={event => { void selectFile(event); }} /></Field>
      {problem && <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>}
      {busy === "read" || busy === "preview" ? <StateBlock state="loading" /> : backupDocument !== null && <Button onClick={() => { void review(); }} disabled={!ready || busy !== null}>{t("backup.preview")}</Button>}
      {preview && <><Table columns={[t("backup.item"), t("backup.value")]} rows={[
        [t("backup.created"), preview.createdAt], [t("backup.database"), `${new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(preview.databaseBytes)} B`],
        [t("backup.files"), preview.files.length ? preview.files.join(", ") : t("backup.none")],
      ]} /><Warning tone="danger">{t("backup.replaceWarning")}</Warning>
        <Button variant="primary" disabled={busy !== null} onClick={() => { setTyped(""); setConfirming(true); }}>{t("backup.reviewApply")}</Button></>}
      {staged && <Warning>{t("backup.staged")}</Warning>}
    </div>
  </Panel>
    {confirming && preview && <Modal title={t("backup.confirmTitle")} onClose={() => { if (!busy) setConfirming(false); }}>
      <p>{t("backup.confirmHint")}</p>
      <input className="input" aria-label={t("backup.confirmAria")} autoComplete="off" value={typed} disabled={busy !== null} onChange={event => setTyped(event.target.value)} />
      <div className="modal-actions"><Button disabled={busy !== null} onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
        <Button variant="danger" disabled={typed !== "RESTORE" || busy !== null} onClick={() => { void apply(); }}>{t("backup.apply")}</Button></div>
    </Modal>}
  </>;
}
