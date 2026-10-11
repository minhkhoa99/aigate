import { useState } from "react";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { type MessageKey } from "../../shared/i18n";
import { Button, Field, Input, Panel, StateBlock, Warning } from "../../shared/ui";
import { useSetStartup, useStartupStatus, type StartupReason } from "./api";

const reasonKeys: Record<StartupReason, MessageKey> = {
  WINDOWS_ONLY: "startup.reason.windows",
  APPDATA_UNAVAILABLE: "startup.reason.appData",
  STARTUP_FOLDER_MISSING: "startup.reason.folder",
  BUILD_REQUIRED: "startup.reason.build",
  SECRET_KEY_OVERRIDE: "startup.reason.secret",
  STARTUP_CONFLICT: "startup.reason.conflict",
};

export function WindowsStartupSettings() {
  const { language, t } = useLocale();
  const status = useStartupStatus();
  const change = useSetStartup();
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const current = status.data;
  const problem = failure ? toProblem(failure, language) : null;
  const apply = () => {
    if (!current || !password || change.isPending) return;
    setFailure(null);
    change.mutate({ enabled: !current.enabled, password }, { onSuccess: () => setPassword(""), onError: setFailure });
  };
  return <Panel title={t("startup.title")} detail={t("startup.hint")} className="section-gap">
    {status.isError ? <Warning tone="danger"><code>{toProblem(status.error, language).code}</code> · {toProblem(status.error, language).message}<div className="section-gap"><Button onClick={() => { void status.refetch(); }}>{t("common.retry")}</Button></div></Warning>
      : !current ? <StateBlock state="loading" /> : <div className="stack">
        <p>{t(current.enabled ? "startup.enabled" : "startup.disabled")}</p>
        {current.reason && <Warning tone="danger">{t(reasonKeys[current.reason])}</Warning>}
        <p className="muted">{t("startup.notice")}</p>
        {(current.supported || current.enabled) && <><Field label={t("startup.password")}><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>
          <div><Button variant={current.enabled ? "danger" : "primary"} disabled={!password || change.isPending} onClick={apply}>{t(current.enabled ? "startup.disable" : "startup.enable")}</Button></div></>}
        {problem && <Warning tone="danger"><code>{problem.code}</code> · {problem.message}</Warning>}
      </div>}
  </Panel>;
}
