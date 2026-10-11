import { useState } from "react";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { Button, Panel, StateBlock, Warning } from "../../shared/ui";
import { useCheckUpdate, useUpdateStatus } from "./api";

export function SignedUpdateSettings() {
  const { language, t } = useLocale();
  const status = useUpdateStatus();
  const check = useCheckUpdate();
  const [failure, setFailure] = useState<unknown>(null);
  const current = status.data;
  const problem = failure ? toProblem(failure, language) : null;
  const run = () => { if (check.isPending) return; setFailure(null); check.mutate(undefined, { onError: setFailure }); };
  return <Panel title={t("update.title")} detail={t("update.hint")} className="section-gap">
    {status.isError ? <Warning tone="danger"><code>{toProblem(status.error, language).code}</code> · {toProblem(status.error, language).message}<div className="section-gap"><Button onClick={() => { void status.refetch(); }}>{t("common.retry")}</Button></div></Warning>
      : !current ? <StateBlock state="loading" /> : <div className="stack">
        <p>{t("update.current", { version: current.currentVersion })}</p>
        {current.channel !== "ready" ? <Warning tone="danger">{t(current.channel === "invalid" ? "update.invalidChannel" : "update.noChannel")}</Warning> : <>
          {current.lastCheck ? <p>{t(current.lastCheck.hasUpdate ? "update.available" : "update.currentLatest", { version: current.lastCheck.latestVersion })}</p>
            : <p className="muted">{t("update.notChecked")}</p>}
          <div><Button onClick={run} disabled={check.isPending || current.checking}>{t(check.isPending ? "update.checking" : "update.check")}</Button></div>
        </>}
        {problem && <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>}
        <p className="muted">{t("update.notice")}</p>
      </div>}
  </Panel>;
}
