import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, CopyField, Dot, Field, Input, Modal, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useToast } from "../../shared/toast";
import { useApplyMitmPreview, useCreateProxyPool, useDeleteProxyPool, useDeployCloudflareRelay, useDeployDenoRelay, useDeployVercelRelay, useDisableTunnel, useEnableTunnel, useMitmPreview, useMitmStatus, useProxyPools, useProxyRotations, useTestProxyPool, useTunnelStatus, useUpdateProxyPool, useUpdateProxyRotation, type MitmPreview, type ProxyPool, type ProxyRotation } from "./api";

export function ProxyPools() {
  const [editing, setEditing] = useState<ProxyPool | null | "new">(null);
  const [remove, setRemove] = useState<ProxyPool | null>(null);
  const pools = useProxyPools();
  const removePool = useDeleteProxyPool();
  const test = useTestProxyPool();
  const toast = useToast();
  const fail = (error: unknown) => toast({ tone: "error", ...toProblem(error) });
  const rows = pools.data ?? [];
  return <><PageHeading eyebrow="Network / Proxy Pools" title="Proxy pools" description="Route outbound provider requests through controlled network paths." action={<Link className="button button-primary" to="/network/proxy-pools/deploy">+ Deploy relay</Link>} />
    <Warning>When strict proxy is enabled, a failed proxy must fail the request instead of falling back to direct traffic.</Warning>
    <Panel title="Configured pools" detail="HTTP proxies and hosted relays" action={<Button variant="primary" onClick={() => setEditing("new")}>+ Add proxy</Button>} className="section-gap panel-flush">
      {pools.isPending ? <StateBlock state="loading" /> : pools.isError ? <StateBlock state="error" code={toProblem(pools.error).code} action={<Button onClick={() => void pools.refetch()}>Retry</Button>} />
        : <Table empty="No proxy pools yet. Add an HTTP proxy or deploy a relay." columns={["Pool", "Type", "Connections", "Strict proxy", "Health", ""]} rows={rows.map((pool) => [
          <div><strong>{pool.name}</strong><small className="muted"> · {pool.isActive ? "enabled" : "disabled"}</small></div>, <code>{pool.type}</code>, <span className="mono">{pool.boundConnectionCount}</span>,
          <Pill tone={pool.strictProxy ? "info" : "muted"}>{pool.strictProxy ? "On" : "Off"}</Pill>, <Pill tone={pool.testStatus === "active" ? "healthy" : pool.testStatus === "error" ? "danger" : "muted"}>{pool.testStatus}</Pill>,
          <><Button variant="ghost" disabled={test.isPending} onClick={() => test.mutate(pool.id, { onSuccess: (value) => toast({ tone: value.ok ? "success" : "error", message: value.ok ? `${pool.name} is reachable.` : value.error ?? `${pool.name} failed its probe.` }), onError: fail })}>{test.isPending && test.variables === pool.id ? "Testing…" : "Test"}</Button><Button variant="ghost" onClick={() => setEditing(pool)}>Manage</Button><Button variant="ghost" onClick={() => setRemove(pool)}>Delete</Button></>,
        ])} />}
    </Panel>
    <NoAuthRotations pools={rows.filter((pool) => pool.isActive)} />
    {editing && <ProxyPoolForm pool={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    {remove && <ConfirmDialog name={remove.name} detail={remove.boundConnectionCount ? "Delete is blocked until this pool is removed from its connections." : undefined} onClose={() => setRemove(null)} onConfirm={() => removePool.mutate(remove.id, { onSuccess: () => { setRemove(null); toast({ tone: "success", message: `Deleted ${remove.name}.` }); }, onError: fail })} />}
  </>;
}

function NoAuthRotations({ pools }: { pools: ProxyPool[] }) {
  const rotations = useProxyRotations();
  const update = useUpdateProxyRotation();
  const toast = useToast();
  const save = (rotation: ProxyRotation, rotateStrategy: ProxyRotation["rotateStrategy"], proxyPoolId: string | null) => update.mutate(
    { providerId: rotation.providerId, rotateStrategy, proxyPoolId },
    { onSuccess: () => toast({ tone: "success", message: "Proxy strategy saved for " + rotation.name + "." }), onError: (error) => toast({ tone: "error", ...toProblem(error) }) },
  );
  return <Panel title="Keyless provider proxy strategy" detail="Public providers do not need a stored connection or API key." className="section-gap">
    {rotations.isPending ? <StateBlock state="loading" /> : rotations.isError ? <StateBlock state="error" code={toProblem(rotations.error).code} action={<Button onClick={() => void rotations.refetch()}>Retry</Button>} />
      : rotations.data?.length ? <div className="stack">{rotations.data.map((rotation) => <div className="list-row" key={rotation.providerId}><div><strong>{rotation.name}</strong><small><code>{rotation.providerId}</code></small></div><div className="row"><Field label="Strategy"><select className="input" value={rotation.rotateStrategy} disabled={update.isPending} onChange={(event) => { const value = event.target.value; if (value === "none" || value === "round-robin" || value === "random") save(rotation, value, rotation.proxyPoolId); }}><option value="none">Fixed pool</option><option value="round-robin">Round robin</option><option value="random">Random</option></select></Field><Field label="Pool"><select className="input" value={rotation.proxyPoolId ?? ""} disabled={update.isPending || rotation.rotateStrategy !== "none"} onChange={(event) => save(rotation, rotation.rotateStrategy, event.target.value || null)}><option value="">Direct / environment proxy</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.type})</option>)}</select></Field></div></div>)}</div>
        : <p className="muted">No keyless chat providers are available in this catalog.</p>}
  </Panel>;
}

function ProxyPoolForm({ pool, onClose }: { pool?: ProxyPool; onClose: () => void }) {
  const create = useCreateProxyPool();
  const update = useUpdateProxyPool();
  const toast = useToast();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const type = (["http", "vercel", "cloudflare", "deno"] as const).find((candidate) => candidate === value("type")) ?? "http";
    const body = { name: value("name"), proxyUrl: value("proxyUrl"), noProxy: value("noProxy"), type, isActive: form.get("isActive") === "on", strictProxy: form.get("strictProxy") === "on" };
    const done = () => { toast({ tone: "success", message: pool ? `Updated ${body.name}.` : `Added ${body.name}.` }); onClose(); };
    const fail = (error: unknown) => toast({ tone: "error", ...toProblem(error) });
    if (pool) update.mutate({ id: pool.id, ...body }, { onSuccess: done, onError: fail }); else create.mutate(body, { onSuccess: done, onError: fail });
  };
  return <Modal title={pool ? `Manage ${pool.name}` : "Add proxy pool"} onClose={onClose}><form onSubmit={submit} className="stack"><Field label="Name"><Input name="name" defaultValue={pool?.name} required maxLength={64} /></Field><Field label="Type"><select className="input" name="type" defaultValue={pool?.type ?? "http"}><option value="http">HTTP proxy</option><option value="vercel">Vercel relay</option><option value="cloudflare">Cloudflare relay</option><option value="deno">Deno relay</option></select></Field><Field label="Proxy or relay URL" hint="Relay URLs must be HTTPS. Credentials embedded in a URL are refused."><Input name="proxyUrl" defaultValue={pool?.proxyUrl} required maxLength={2048} placeholder="https://proxy.example.com" /></Field><Field label="No proxy hosts" hint="Comma-separated hosts or .suffixes."><Input name="noProxy" defaultValue={pool?.noProxy} maxLength={1024} placeholder="localhost,.internal.example" /></Field><label className="choice-card"><input name="isActive" type="checkbox" defaultChecked={pool?.isActive ?? true} /> Enable this pool</label><label className="choice-card"><input name="strictProxy" type="checkbox" defaultChecked={pool?.strictProxy ?? false} /> Fail requests if this proxy cannot be reached</label><div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? "Saving…" : "Save"}</Button></div></form></Modal>;
}

export function DeployWizard() {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<"vercel" | "cloudflare" | "deno">("vercel");
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [orgDomain, setOrgDomain] = useState("");
  const [projectName, setProjectName] = useState("aigate-relay");
  const vercel = useDeployVercelRelay();
  const cloudflare = useDeployCloudflareRelay();
  const deno = useDeployDenoRelay();
  const pending = vercel.isPending || cloudflare.isPending || deno.isPending;
  const toast = useToast();
  const options = {
    onSuccess: (result: { deployUrl: string }) => toast({ tone: "success" as const, message: `Relay deployed at ${result.deployUrl}.` }),
    onError: (error: unknown) => toast({ tone: "error", ...toProblem(error) }),
  };
  const finish = () => {
    if (platform === "vercel") vercel.mutate({ vercelToken: token, projectName }, options);
    else if (platform === "cloudflare") cloudflare.mutate({ apiToken: token, accountId, projectName }, options);
    else deno.mutate({ denoToken: token, orgDomain, projectName }, options);
  };
  const credentialsValid = token.trim().length >= 8 && (platform !== "cloudflare" || /^[a-f0-9]{32}$/i.test(accountId.trim())) && (platform !== "deno" || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:deno\.net|deno\.dev)$/i.test(orgDomain.trim()));
  return <><PageHeading eyebrow="Network / Proxy Pools / Deploy" title="Deploy a relay" description="Create a hosted relay and attach it to a proxy pool." />
    <div className="wizard-steps">{["Platform", "Credentials", "Review"].map((s, i) => <div key={s} className={step === i + 1 ? "active" : ""}><span>{i + 1}</span>{s}</div>)}</div>
    <div className="split section-gap"><Panel title={step === 1 ? "Choose platform" : step === 2 ? "Deployment credentials" : "Review deployment"}>
        {step === 1 && <div className="stack">{([["vercel", "Vercel Edge relay", "Managed edge deployment"], ["cloudflare", "Cloudflare Worker", "Workers script deployment"], ["deno", "Deno Deploy", "Deno Deploy app and revision"]] as const).map(([value, label, detail]) => <label key={value} className="choice-card"><input type="radio" name="platform" checked={platform === value} onChange={() => setPlatform(value)} /> {label} <small>{detail}</small></label>)}</div>}
        {step === 2 && <div className="stack"><Field label={platform === "vercel" ? "Vercel deployment token" : platform === "cloudflare" ? "Cloudflare API token" : "Deno Deploy organization token"}><input className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste a new token" autoComplete="off" /></Field>{platform === "cloudflare" && <Field label="Cloudflare account ID"><input className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="32-character account ID" autoComplete="off" /></Field>}{platform === "deno" && <Field label="Deno Deploy organization domain" hint="For example, team.deno.net"><input className="input" value={orgDomain} onChange={(event) => setOrgDomain(event.target.value)} placeholder="team.deno.net" autoComplete="off" /></Field>}<Field label="Project name"><input className="input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="aigate-relay" /></Field><Warning>Token values are used for deployment and are never persisted.</Warning></div>}
        {step === 3 && <div className="stack"><div className="list-row"><div><strong>Platform</strong><small>{platform === "vercel" ? "Vercel Edge relay" : platform === "cloudflare" ? "Cloudflare Worker" : "Deno Deploy"}</small></div><Pill tone="info">Selected</Pill></div><div className="list-row"><div><strong>Proxy policy</strong><small>Fail closed when strict proxy is enabled</small></div><Pill tone="healthy">Safe</Pill></div></div>}
        <div className="modal-actions"><Button disabled={step === 1 || pending} onClick={() => setStep(Math.max(1, step - 1))}>Back</Button><Button variant="primary" disabled={pending || (step === 2 && !credentialsValid)} onClick={() => step === 3 ? finish() : setStep(Math.min(3, step + 1))}>{pending ? "Deploying…" : step === 3 ? "Deploy relay" : "Continue"}</Button></div>
      </Panel><Panel title="Deployment state"><div className="flow-steps">{["Create relay", "Wait for readiness", "Validate endpoint", "Attach pool"].map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, "0")}</span><strong>{s}</strong><Pill>{step === 3 && i === 0 ? "Ready" : "Pending"}</Pill></div>)}</div></Panel></div>
  </>;
}

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