import { useState } from "react";
import { Button, ConfirmDialog, CopyField, Dot, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useToast } from "../../shared/toast";
import { useApplyMitmPreview, useDisableTunnel, useEnableTunnel, useMitmPreview, useMitmStatus, useTunnelStatus, type MitmPreview } from "./api";

export { ProxyPools, DeployWizard } from "./proxy-pools";

export function Tunnel() {
  const [confirm, setConfirm] = useState<"enable" | "disable" | null>(null);
  const query = useTunnelStatus();
  const enable = useEnableTunnel();
  const disable = useDisableTunnel();
  const toast = useToast();
  const fail = (error: unknown) => toast({ tone: "error", ...toProblem(error) });
  const status = query.data;
  const act = () => {
    if (confirm === "enable") enable.mutate(undefined, { onSuccess: () => { setConfirm(null); toast({ tone: "success", message: "Tailscale Funnel enabled." }); }, onError: fail });
    if (confirm === "disable") disable.mutate(undefined, { onSuccess: () => { setConfirm(null); toast({ tone: "success", message: "Tailscale Funnel disabled." }); }, onError: fail });
  };
  return <><PageHeading eyebrow="Network / Tunnel" title="Remote access" description="Expose the gateway through Tailscale Funnel after server-side access checks pass." />
    <Warning tone="danger">Funnel publishes this gateway to the public internet. AIGate requires dashboard sign-in and an active API key both before showing the enable action and again in the server.</Warning>
    {query.isPending ? <StateBlock state="loading" /> : query.isError ? <StateBlock state="error" code={toProblem(query.error).code} action={<Button onClick={() => void query.refetch()}>Retry</Button>} /> : status && <div className="grid grid-2 section-gap">
      <Panel title="Tailscale Funnel" detail="Public HTTPS access via the Tailscale daemon" action={<Pill tone={status.running ? "healthy" : status.installed ? "muted" : "warning"}>{status.running ? "Enabled" : status.installed ? "Disabled" : "Not installed"}</Pill>}>
        <div className="stack">{!status.installed ? <p className="muted">Install Tailscale and sign in on the machine running AIGate. Then reload this page.</p>
          : status.running && status.publicUrl ? <CopyField label="Public URL" value={status.publicUrl} /> : <p className="muted">Tailscale is installed. Funnel is not exposing AIGate.</p>}
          {status.blockedReason && <Warning>{status.blockedReason}</Warning>}
          {status.running ? <Button variant="danger" disabled={disable.isPending} onClick={() => setConfirm("disable")}>Disable Funnel</Button>
            : <Button variant="primary" disabled={!status.installed || !status.accessReady || status.routeConflict || enable.isPending} onClick={() => setConfirm("enable")}>{enable.isPending ? "Enabling…" : "Enable Funnel"}</Button>}
        </div>
      </Panel>
      <Panel title="Local endpoint"><div className="stack"><CopyField label="AIGate server" value={`${window.location.origin}/v1`} /><div className="list-row"><Dot tone={status.running ? "warning" : "healthy"} /><div><strong>{status.running ? "Public access is enabled" : "Public access is disabled"}</strong><small>{status.running ? "Use the public URL only with an API key." : "The service remains private until explicitly enabled."}</small></div><Pill tone={status.running ? "warning" : "healthy"}>{status.running ? "Public" : "Private"}</Pill></div></div></Panel>
    </div>}
    {confirm && <ConfirmDialog name={confirm === "enable" ? "Enable Tailscale Funnel" : "Disable Tailscale Funnel"} detail={confirm === "enable" ? "This makes AIGate reachable from the public internet." : "This stops the AIGate Funnel route."} onClose={() => setConfirm(null)} onConfirm={act} />}
  </>;
}

export function Mitm() {
  const status = useMitmStatus(), make = useMitmPreview(), apply = useApplyMitmPreview(), [preview, setPreview] = useState<MitmPreview | null>(null), toast = useToast(), fail = (error: unknown) => toast({ tone: "error", ...toProblem(error) });
  return <><PageHeading eyebrow="Network / MITM" title="Local interception" description="Generate and trust a local CA, then route supported IDE API hosts through AIGate." />{status.isPending ? <StateBlock state="loading" /> : status.isError ? <StateBlock state="error" code={toProblem(status.error).code} /> : <><Warning tone="danger"><strong>System trust changes.</strong> Review the generated CA before installing it in the operating system trust store.</Warning><div className="grid grid-2 section-gap"><Panel title="Certificate authority" detail={status.data!.certificate.path}><div className="stack"><Pill tone={status.data!.certificate.present ? "healthy" : "muted"}>{status.data!.certificate.present ? "Generated" : "Absent"}</Pill><div className="row"><Button disabled={make.isPending || status.data!.certificate.present} onClick={() => make.mutate("generate", { onSuccess: setPreview, onError: fail })}>Generate CA</Button><Button variant="primary" disabled={make.isPending || !status.data!.certificate.present} onClick={() => make.mutate("install", { onSuccess: setPreview, onError: fail })}>Install CA</Button>{status.data!.listener.running ? <Button variant="danger" disabled={make.isPending} onClick={() => make.mutate("stop", { onSuccess: setPreview, onError: fail })}>Stop listener</Button> : <Button variant="primary" disabled={make.isPending || !status.data!.certificate.present} onClick={() => make.mutate("start", { onSuccess: setPreview, onError: fail })}>Start listener</Button>}<Button variant="danger" disabled={make.isPending || !status.data!.certificate.present || status.data!.listener.running} onClick={() => make.mutate("remove", { onSuccess: setPreview, onError: fail })}>Remove CA</Button></div></div></Panel><Panel title="Interception targets" detail={`TLS listener on 127.0.0.1:${status.data!.listener.configuredPort}`}><Table columns={["Host", "State"]} rows={status.data!.targets.map((target) => [<code>{target.host}</code>, <Pill tone={target.enabled ? "healthy" : "muted"}>{target.enabled ? "Enabled" : target.blockedReason}</Pill>])} /></Panel></div>{preview && <Panel title="Review MITM change" detail={preview.certificatePath} className="section-gap"><div className="stack"><pre className="code-block">{preview.changes.join("\n")}</pre><p className="muted">Preview expires at {new Date(preview.expiresAt).toLocaleTimeString()}.</p><div className="row"><Button onClick={() => setPreview(null)}>Cancel</Button><Button variant="primary" disabled={apply.isPending} onClick={() => apply.mutate(preview.previewId, { onSuccess: () => { setPreview(null); toast({ tone: "success", message: "MITM change applied." }); }, onError: fail })}>{apply.isPending ? "Applying..." : "Apply reviewed change"}</Button></div></div></Panel>}</>}</>;
}