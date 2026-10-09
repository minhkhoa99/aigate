import { useState } from "react";
import { Button, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import type { MessageKey } from "../../shared/i18n";
import { useInstallPxpipe, usePatchTokenSaverSettings, usePxpipeStatus, useTokenSaverSettings, type GatewaySettings } from "./api";

const STAGES = ["RTK", "Headroom", "Caveman", "Ponytail", "PXPIPE"] as const;
const LEVEL_LABELS: Record<GatewaySettings["cavemanLevel"], MessageKey> = {
  lite: "tokenSaver.levelLite", full: "tokenSaver.levelFull", ultra: "tokenSaver.levelUltra",
};

// docs/contracts/token-saver-ui-i18n.md: presentation over the existing settings and explicit install APIs.
export function TokenSaver() {
  const { language, t } = useLocale();
  const query = useTokenSaverSettings();
  const pxpipe = usePxpipeStatus();
  const installPxpipe = useInstallPxpipe();
  const save = usePatchTokenSaverSettings();
  const showToast = useToast();
  const [headroomUrl, setHeadroomUrl] = useState<string | null>(null);
  const settingsProblem = query.isError ? toProblem(query.error, language) : null;
  const pxpipeProblem = pxpipe.isError ? toProblem(pxpipe.error, language) : null;

  if (query.isPending) return <StateBlock state="loading" />;
  if (settingsProblem || !query.data) return <><StateBlock state="error" code={settingsProblem?.code} action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>} />
    {settingsProblem && <Warning tone="danger">{settingsProblem.message}</Warning>}</>;

  const config = query.data;
  const pxpipeReady = pxpipe.data?.installed === true && pxpipe.data.loaded;
  const pxpipeStageNotice: MessageKey | undefined = config.tokenSaverEnabled && config.pxpipeEnabled
    ? pxpipe.isPending ? "tokenSaver.loading" : !pxpipeReady ? "tokenSaver.unavailable" : undefined
    : undefined;
  const patch = (fields: Partial<GatewaySettings>, onSuccess?: () => void) => save.mutate(fields, {
    onSuccess,
    onError: (error) => showToast({ tone: "error", error }),
  });
  const toggle = (labelKey: MessageKey, detailKey: MessageKey, checked: boolean, field: string, disabled = false) =>
    <div className="list-row" key={field}><div><strong>{t(labelKey)}</strong><small>{t(detailKey)}</small></div>
      <input type="checkbox" checked={checked} disabled={disabled || save.isPending}
        aria-label={field === "tokenSaverEnabled" ? t(labelKey) : t("tokenSaver.enableAria", { stage: t(labelKey) })}
        onChange={(event) => patch({ [field]: event.target.checked })} /></div>;
  const stage = (name: typeof STAGES[number], enabled: boolean, notice?: MessageKey) => <div key={name}>
    <span>{String(STAGES.indexOf(name) + 1).padStart(2, "0")}</span><strong>{name}</strong>
    <Pill tone={notice ? "warning" : enabled ? "healthy" : "muted"}>{t(notice ?? (enabled ? "tokenSaver.enabled" : "tokenSaver.off"))}</Pill>
  </div>;
  const levelSelect = (kind: "caveman" | "ponytail") => {
    const label = t(kind === "caveman" ? "tokenSaver.cavemanLevel" : "tokenSaver.ponytailLevel");
    return <div className="list-row"><strong>{label}</strong><select className="input" aria-label={label}
      value={kind === "caveman" ? config.cavemanLevel : config.ponytailLevel}
      disabled={save.isPending}
      onChange={(event) => { const level = event.target.value; if (level === "lite" || level === "full" || level === "ultra")
        patch(kind === "caveman" ? { cavemanLevel: level } : { ponytailLevel: level }); }}>
      {(["lite", "full", "ultra"] as const).map((level) => <option key={level} value={level}>{t(LEVEL_LABELS[level])}</option>)}
    </select></div>;
  };

  return <>
    <PageHeading eyebrow={t("tokenSaver.eyebrow")} title={t("tokenSaver.title")} description={t("tokenSaver.description")}
      action={<Pill tone={config.tokenSaverEnabled ? "healthy" : "warning"}>{t(config.tokenSaverEnabled ? "tokenSaver.enabled" : "tokenSaver.disabled")}</Pill>} />
    <Panel title={t("tokenSaver.master")} detail={t("tokenSaver.masterHint")}>
      {toggle("tokenSaver.masterLabel", "tokenSaver.masterDetail", config.tokenSaverEnabled, "tokenSaverEnabled")}
    </Panel>
    <Panel title={t("tokenSaver.pipeline")} detail={t("tokenSaver.pipelineHint")} className="section-gap"><div className="pipeline">
      {stage("RTK", config.tokenSaverEnabled && config.rtkEnabled)}
      {stage("Headroom", config.tokenSaverEnabled && config.headroomEnabled)}
      {stage("Caveman", config.tokenSaverEnabled && config.cavemanEnabled)}
      {stage("Ponytail", config.tokenSaverEnabled && config.ponytailEnabled)}
      {stage("PXPIPE", config.tokenSaverEnabled && config.pxpipeEnabled && pxpipeReady, pxpipeStageNotice)}
    </div></Panel>
    <Panel title={t("tokenSaver.controls")} className="section-gap">
      {toggle("tokenSaver.rtkLabel", "tokenSaver.rtkDetail", config.rtkEnabled, "rtkEnabled", !config.tokenSaverEnabled)}
      {toggle("tokenSaver.headroomLabel", "tokenSaver.headroomDetail", config.headroomEnabled, "headroomEnabled", !config.tokenSaverEnabled)}
      {config.headroomEnabled && <div className="list-row token-saver-url"><div><strong>{t("tokenSaver.headroomUrl")}</strong><small>{t("tokenSaver.headroomUrlHint")}</small></div>
        <input className="input" type="url" aria-label={t("tokenSaver.headroomUrl")} value={headroomUrl ?? config.headroomUrl}
          onChange={(event) => setHeadroomUrl(event.target.value)} onBlur={() => {
            const next = headroomUrl;
            if (next === null) return;
            if (next === "" || next === config.headroomUrl) { setHeadroomUrl(null); return; }
            if (!save.isPending)
              patch({ headroomUrl: next }, () => setHeadroomUrl((current) => current === next ? null : current));
          }} /></div>}
      {config.headroomEnabled && toggle("tokenSaver.userMessages", "tokenSaver.userMessagesHint", config.headroomCompressUserMessages, "headroomCompressUserMessages")}
      {toggle("tokenSaver.cavemanLabel", "tokenSaver.cavemanDetail", config.cavemanEnabled, "cavemanEnabled", !config.tokenSaverEnabled)}
      {config.cavemanEnabled && levelSelect("caveman")}
      {toggle("tokenSaver.ponytailLabel", "tokenSaver.ponytailDetail", config.ponytailEnabled, "ponytailEnabled", !config.tokenSaverEnabled)}
      {config.ponytailEnabled && levelSelect("ponytail")}
      {pxpipe.isPending ? <StateBlock state="loading" /> : pxpipeProblem ? <>
        <StateBlock state="error" code={pxpipeProblem.code} action={<Button onClick={() => void pxpipe.refetch()}>{t("common.retry")}</Button>} />
        <Warning tone="danger">{pxpipeProblem.message}</Warning>
      </> : <div className="list-row"><div><strong>{t("tokenSaver.pxpipeLabel")}</strong><small>
        {t(pxpipeReady ? "tokenSaver.pxpipeReady" : pxpipe.data?.installed ? "tokenSaver.pxpipeUnavailable" : "tokenSaver.pxpipeMissing")}
        {pxpipe.data?.version ? ` · v${pxpipe.data.version}` : ""}
      </small></div>
        {!pxpipeReady ? <Button disabled={installPxpipe.isPending || pxpipe.data?.installing}
          onClick={() => installPxpipe.mutate(undefined, { onError: (error) => showToast({ tone: "error", error }) })}>
          {t(installPxpipe.isPending || pxpipe.data?.installing ? "tokenSaver.installing" : pxpipe.data?.installed ? "tokenSaver.reinstall" : "tokenSaver.install")}
        </Button> : <input type="checkbox" checked={config.pxpipeEnabled} disabled={!config.tokenSaverEnabled || save.isPending}
          aria-label={t("tokenSaver.enableAria", { stage: "PXPIPE" })} onChange={(event) => patch({ pxpipeEnabled: event.target.checked })} />}
      </div>}
    </Panel>
  </>;
}
