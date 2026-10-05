import { useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ApiError } from "../../shared/api";
import { toProblem, type Problem } from "../../shared/errors";
import { Button, CopyField, Field, Modal, PageHeading, Panel, StateBlock, Table, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { downloadSettingsFile, useRuntimeInfo, useSettingsImport, type SettingsPreview } from "./api";

const MAX_FILE_BYTES = 64 * 1024;

export function SettingsGeneral({ theme, onTheme }: { theme: string; onTheme: (theme: string) => void }) {
  const runtime = useRuntimeInfo();
  const imports = useSettingsImport();
  const showToast = useToast();
  const [document, setDocument] = useState<unknown>(null);
  const [review, setReview] = useState<SettingsPreview | null>(null);
  const [failure, setFailure] = useState<Problem | null>(null);
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const busy = reading || imports.preview.isPending || imports.apply.isPending;
  const fail = (error: unknown) => { const problem = toProblem(error); setFailure(problem); showToast({ tone: "error", ...problem }); };

  const preview = (value: unknown) => {
    setReview(null); setFailure(null);
    imports.preview.mutate(value, { onSuccess: setReview, onError: fail });
  };
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setDocument(null); setReview(null); setFailure(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { fail(new ApiError(400, "INVALID_REQUEST", "Settings file must be at most 64 KiB.")); return; }
    setReading(true);
    try {
      let value: unknown;
      try { value = JSON.parse(await file.text()); }
      catch { throw new ApiError(400, "INVALID_REQUEST", "Could not read a JSON settings document. Choose an AIGate settings export."); }
      setDocument(value); preview(value);
    } catch (error) { fail(error); }
    finally { setReading(false); }
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
      onSuccess: () => { setReview(null); setDocument(null); setConfirming(false); showToast({ tone: "success", message: "Settings imported. Changes apply to the next request." }); },
      onError: (error) => { setReview(null); setConfirming(false); fail(error); },
    });
  };
  const data = runtime.data;

  return <><PageHeading eyebrow="Settings / General" title="General settings" description="Runtime information, browser appearance and portable gateway settings." />
    <div className="split"><Panel title="Gateway runtime" detail="Startup settings need a server restart." className="settings-runtime" action={<Button onClick={() => { void runtime.refetch(); }} disabled={runtime.isFetching}>Refresh</Button>}>
      {runtime.error ? <div className="state-block error"><code>{toProblem(runtime.error).code}</code><p>{toProblem(runtime.error).message}</p><Button onClick={() => { void runtime.refetch(); }}>Retry</Button></div>
        : !data ? <StateBlock state="loading" /> : <div className="stack">
          <CopyField label="Client endpoint" value={`${window.location.origin}/v1`} />
          <Table columns={["Setting", "Running value"]} rows={[
            ["Bind address · HOST", <code>{data.bindAddress ?? "Not listening"}</code>], ["Port · PORT", String(data.port ?? "Not listening")],
            ["Data directory · AIGATE_DATA_DIR", <code>{data.dataDir}</code>], ["Usage timezone · AIGATE_USAGE_TIMEZONE", data.usageTimezone],
            ["Usage retention · AIGATE_USAGE_RETENTION_DAYS", `${data.usageRetentionDays} days`], ["Daily totals retention", `${data.dailyRetentionDays} days`],
            ["Stream idle timeout · AIGATE_STREAM_IDLE_TIMEOUT_MS", `${data.streamIdleTimeoutMs / 1000} seconds`],
            ["Runtime / database", `${data.nodeVersion} / ${data.databaseDriver}`], ["Uptime", `${Math.floor(data.uptimeSeconds / 60)} minutes`],
          ]} />
          <Button onClick={() => { void download("runtime"); }} disabled={downloading}>Download runtime info</Button>
        </div>}
    </Panel><Panel title="Presentation and controls">
      <div className="stack"><Field label="Theme" hint="Applies immediately in this browser; not included in server settings exports."><select className="input" value={theme} onChange={(event) => onTheme(event.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select></Field>
        <p className="muted">The dashboard currently uses English. Additional languages and operating-system startup integration are separate features.</p>
        <Link to="/settings/auth" className="button">Auth and API access →</Link><Link to="/gateway/routing" className="button">Routing and fallback →</Link>
        <Link to="/gateway/token-saver" className="button">Token Saver →</Link><Link to="/network/proxy-pools" className="button">Outbound proxy pools →</Link>
      </div>
    </Panel></div>
    <Panel title="Portable settings" detail="AIGate format v1 · typed gateway settings only · applies to the next request" className="section-gap" action={<Button onClick={() => { void download("export"); }} disabled={downloading || busy}>Export current settings</Button>}>
      <p className="muted">Keep an export before importing. These files contain no saved account credentials, API keys, service URLs or environment variables. Connections, usage and other tables are preserved. Configure Headroom URLs separately in Token Saver.</p>
      <Field label="Import settings JSON" hint="At most 64 KiB. Review the changes before applying."><input className="input" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { void selectFile(event); }} /></Field>
      {failure && <Warning tone="danger"><code>{failure.code}</code> · {failure.message}</Warning>}
      {imports.preview.isPending || reading ? <StateBlock state="loading" /> : review && <>
        <Table columns={["Setting", "Current", "Imported"]} rows={review.changes.map((change) => [<code>{change.key}</code>, String(change.before), String(change.after)])} empty="This document matches the current settings." />
        {review.changes.some((change) => (change.key === "requireLogin" || change.key === "requireApiKey") && change.after === false) && <Warning tone="danger">This import disables an access requirement. Review Auth & Access and public tunnel settings before applying.</Warning>}
        <div className="modal-actions"><Button onClick={() => { setTyped(""); setConfirming(true); }} variant="primary" disabled={busy || review.changes.length === 0}>Review and apply import</Button></div>
      </>}
      {document !== null && !review && !busy && <Button onClick={() => preview(document)}>Preview again</Button>}
    </Panel>
    {confirming && review && <Modal title="Apply settings import" onClose={() => { if (!imports.apply.isPending) setConfirming(false); }}>
      <p>{review.changes.length} setting(s) will change. Missing keys are preserved. Type <code>IMPORT</code> to confirm.</p>
      <input className="input" aria-label="Type IMPORT to confirm" autoComplete="off" value={typed} disabled={imports.apply.isPending} onChange={(event) => setTyped(event.target.value)} />
      <div className="modal-actions"><Button onClick={() => setConfirming(false)} disabled={imports.apply.isPending}>Cancel</Button><Button variant="primary" onClick={apply} disabled={typed !== "IMPORT" || imports.apply.isPending}>{imports.apply.isPending ? "Applying…" : "Apply import"}</Button></div>
    </Modal>}
  </>;
}
