import { useMemo, useState } from "react";
import { Button, ConfirmDialog, CopyField, Dot, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { isApiError } from "../../shared/api";
import { toProblem } from "../../shared/errors";
import { createFormatters } from "../../shared/i18n";
import { useLocale } from "../../shared/locale";
import { useToast } from "../../shared/toast";
import { useApplyMitmPreview, useDisableTunnel, useEnableTunnel, useMitmPreview, useMitmStatus, useTunnelStatus, type MitmPreview } from "./api";

export { ProxyPools, DeployWizard } from "./proxy-pools";

export function Tunnel() {
  const { language, t } = useLocale();
  const [confirm, setConfirm] = useState<"enable" | "disable" | null>(null);
  const query = useTunnelStatus();
  const enable = useEnableTunnel();
  const disable = useDisableTunnel();
  const pending = enable.isPending || disable.isPending;
  const toast = useToast();
  const fail = (error: unknown) => toast({ tone: "error", error });
  const problem = query.isError ? toProblem(query.error, language) : null;
  const status = query.data;
  const act = () => {
    if (pending) return;
    if (confirm === "enable") enable.mutate(undefined, { onSuccess: () => { setConfirm(null); toast({ tone: "success", localized: { key: "tunnel.enabledToast" } }); }, onError: fail });
    if (confirm === "disable") disable.mutate(undefined, { onSuccess: () => { setConfirm(null); toast({ tone: "success", localized: { key: "tunnel.disabledToast" } }); }, onError: fail });
  };
  return <><PageHeading eyebrow={t("tunnel.eyebrow")} title={t("tunnel.title")} description={t("tunnel.description")} />
    <Warning tone="danger">{t("tunnel.warning")}</Warning>
    {query.isPending ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("tunnel.loadFailed")}</strong><p>{problem.message}</p><Button onClick={() => void query.refetch()}>{t("common.retry")}</Button></div> : status && <div className="grid grid-2 section-gap">
      <Panel title={t("tunnel.statusTitle")} detail={t("tunnel.statusDetail")} action={<Pill tone={status.running ? "healthy" : status.installed ? "muted" : "warning"}>{status.running ? t("tunnel.enabled") : status.installed ? t("tunnel.disabled") : t("tunnel.notInstalled")}</Pill>}>
        <div className="stack">{!status.installed ? <p className="muted">{t("tunnel.installHint")}</p>
          : status.running && status.publicUrl ? <CopyField label={t("tunnel.publicUrl")} value={status.publicUrl} /> : <p className="muted">{t("tunnel.inactiveHint")}</p>}
          {status.blockedReason && <Warning>{status.blockedReason}</Warning>}
          {status.running ? <Button variant="danger" disabled={pending} onClick={() => setConfirm("disable")}>{disable.isPending ? t("tunnel.disabling") : t("tunnel.disable")}</Button>
            : <Button variant="primary" disabled={!status.installed || !status.accessReady || status.routeConflict || pending} onClick={() => setConfirm("enable")}>{enable.isPending ? t("tunnel.enabling") : t("tunnel.enable")}</Button>}
        </div>
      </Panel>
      <Panel title={t("tunnel.localEndpoint")}><div className="stack"><CopyField label={t("tunnel.server")} value={`${window.location.origin}/v1`} /><div className="list-row"><Dot tone={status.running ? "warning" : "healthy"} /><div><strong>{status.running ? t("tunnel.publicTitle") : t("tunnel.privateTitle")}</strong><small>{status.running ? t("tunnel.publicHint") : t("tunnel.privateHint")}</small></div><Pill tone={status.running ? "warning" : "healthy"}>{status.running ? t("tunnel.public") : t("tunnel.private")}</Pill></div></div></Panel>
    </div>}
    {confirm && <ConfirmDialog key={`${confirm}:${language}`} name={t(confirm === "enable" ? "tunnel.confirmEnable" : "tunnel.confirmDisable")} detail={t(confirm === "enable" ? "tunnel.confirmEnableDetail" : "tunnel.confirmDisableDetail")} pending={pending} onClose={() => { if (!pending) setConfirm(null); }} onConfirm={act} />}
  </>;
}

export function Mitm() {
  const { language, t } = useLocale();
  const format = useMemo(() => createFormatters(language), [language]);
  const status = useMitmStatus();
  const make = useMitmPreview();
  const apply = useApplyMitmPreview();
  const [preview, setPreview] = useState<MitmPreview | null>(null);
  const toast = useToast();
  const fail = (error: unknown) => toast({ tone: "error", error });
  const problem = status.isError ? toProblem(status.error, language) : null;
  const pending = make.isPending || apply.isPending;
  const requestPreview = (action: MitmPreview["action"]) => { if (!pending) make.mutate(action, { onSuccess: setPreview, onError: fail }); };
  const applyPreview = () => {
    if (!preview || pending) return;
    apply.mutate(preview.previewId, { onSuccess: () => { setPreview(null); toast({ tone: "success", localized: { key: "mitm.appliedToast" } }); }, onError: (error) => { if (isApiError(error, "PREVIEW_EXPIRED")) setPreview(null); fail(error); } });
  };
  const view = status.data;
  return <><PageHeading eyebrow={t("mitm.eyebrow")} title={t("mitm.title")} description={t("mitm.description")} />
    {status.isPending ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("mitm.loadFailed")}</strong><p>{problem.message}</p><Button onClick={() => void status.refetch()}>{t("common.retry")}</Button></div> : view && <><Warning tone="danger"><strong>{t("mitm.warningLead")}</strong> {t("mitm.warningBody")}</Warning><div className="grid grid-2 section-gap"><Panel title={t("mitm.caTitle")} detail={view.certificate.path}><div className="stack"><Pill tone={view.certificate.present ? "healthy" : "muted"}>{view.certificate.present ? t("mitm.generated") : t("mitm.absent")}</Pill><div className="row"><Button disabled={pending || view.certificate.present} onClick={() => requestPreview("generate")}>{t("mitm.generate")}</Button><Button variant="primary" disabled={pending || !view.certificate.present} onClick={() => requestPreview("install")}>{t("mitm.install")}</Button>{view.listener.running ? <Button variant="danger" disabled={pending} onClick={() => requestPreview("stop")}>{t("mitm.stop")}</Button> : <Button variant="primary" disabled={pending || !view.certificate.present} onClick={() => requestPreview("start")}>{t("mitm.start")}</Button>}<Button variant="danger" disabled={pending || !view.certificate.present || view.listener.running} onClick={() => requestPreview("remove")}>{t("mitm.remove")}</Button></div></div></Panel><Panel title={t("mitm.targets")} detail={t("mitm.listenerOn", { port: view.listener.configuredPort })}><Table columns={[t("mitm.host"), t("mitm.state")]} rows={view.targets.map((target) => [<code>{target.host}</code>, <Pill tone={target.enabled ? "healthy" : "muted"}>{target.enabled ? t("mitm.enabled") : target.blockedReason}</Pill>])} /></Panel></div>
      {preview && <Panel title={t("mitm.reviewTitle")} detail={preview.certificatePath} className="section-gap"><div className="stack"><pre className="code-block">{preview.changes.join("\n")}</pre><p className="muted">{t("mitm.previewExpires", { time: format.time(Date.parse(preview.expiresAt)) })}</p><div className="row"><Button disabled={pending} onClick={() => setPreview(null)}>{t("common.cancel")}</Button><Button variant="primary" disabled={pending} onClick={applyPreview}>{apply.isPending ? t("mitm.applying") : t("mitm.apply")}</Button></div></div></Panel>}</>}
  </>;
}
