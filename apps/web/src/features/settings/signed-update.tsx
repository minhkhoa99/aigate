import { useState } from "react";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { Button, Field, Input, Panel, StateBlock, Warning } from "../../shared/ui";
import { useCheckUpdate, useRollbackUpdate, useStageUpdate, useUpdateStatus } from "./api";

export function SignedUpdateSettings() {
  const { language, t } = useLocale();
  const status = useUpdateStatus();
  const check = useCheckUpdate();
  const stage = useStageUpdate();
  const rollback = useRollbackUpdate();
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const current = status.data;
  const problem = failure ? toProblem(failure, language) : null;
  const run = () => { if (check.isPending || stage.isPending || rollback.isPending) return; setFailure(null); check.mutate(undefined, { onError: setFailure }); };
  const prepare = () => {
    if (!current?.lastCheck?.hasUpdate || !password || stage.isPending) return;
    setFailure(null);
    stage.mutate({ expectedVersion: current.lastCheck.latestVersion, password }, { onSuccess: () => setPassword(""), onError: setFailure });
  };
  const restore = () => {
    if (!password || rollback.isPending) return;
    setFailure(null);
    rollback.mutate({ password }, { onSuccess: () => setPassword(""), onError: setFailure });
  };
  return <Panel title={t("update.title")} detail={t("update.hint")} className="section-gap">
    {status.isError ? <Warning tone="danger"><code>{toProblem(status.error, language).code}</code> · {toProblem(status.error, language).message}<div className="section-gap"><Button onClick={() => { void status.refetch(); }}>{t("common.retry")}</Button></div></Warning>
      : !current ? <StateBlock state="loading" /> : <div className="stack">
        <p>{t("update.current", { version: current.currentVersion })}</p>
        {current.installation === "source" ? <p className="muted">{t("update.source")}</p> :
          current.installation === "invalid" ? <Warning tone="danger">{t("update.invalidInstall")}</Warning> :
          <p>{t("update.managed")}</p>}
        {current.pendingVersion && <Warning>{t("update.pending", { version: current.pendingVersion })}</Warning>}
        {current.channel !== "ready" ? <Warning tone="danger">{t(current.channel === "invalid" ? "update.invalidChannel" : "update.noChannel")}</Warning> : <>
          {current.lastCheck ? <p>{t(current.lastCheck.hasUpdate ? "update.available" : "update.currentLatest", { version: current.lastCheck.latestVersion })}</p>
            : <p className="muted">{t("update.notChecked")}</p>}
          <div><Button onClick={run} disabled={check.isPending || stage.isPending || rollback.isPending || current.checking}>{t(check.isPending ? "update.checking" : "update.check")}</Button></div>
        </>}
        {current.installation === "managed" && (current.lastCheck?.hasUpdate && !current.pendingVersion || current.rollbackVersion && !current.pendingVersion) &&
          <Field label={t("update.password")}><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>}
        {current.installation === "managed" && !current.pendingVersion &&
          <div className="flex flex-wrap gap-3">
            {current.channel === "ready" && current.lastCheck?.hasUpdate &&
              <Button onClick={prepare} disabled={!password || stage.isPending || rollback.isPending || check.isPending}>{t(stage.isPending ? "update.preparing" : "update.prepare")}</Button>}
            {current.rollbackVersion &&
              <Button variant="secondary" onClick={restore} disabled={!password || rollback.isPending || stage.isPending}>{t("update.rollback", { version: current.rollbackVersion })}</Button>}
          </div>}
        {problem && <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>}
        <p className="muted">{t("update.notice")}</p>
      </div>}
  </Panel>;
}
