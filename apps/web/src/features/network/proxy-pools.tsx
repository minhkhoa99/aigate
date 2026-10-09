import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, Modal, PageHeading, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useToast } from "../../shared/toast";
import { useCreateProxyPool, useDeleteProxyPool, useDeployCloudflareRelay, useDeployDenoRelay, useDeployVercelRelay, useProxyPools, useProxyRotations, useTestProxyPool, useUpdateProxyPool, useUpdateProxyRotation, type ProxyPool, type ProxyRotation } from "./api";

export function ProxyPools() {
  const { language, t } = useLocale();
  const [editing, setEditing] = useState<ProxyPool | null | "new">(null);
  const [remove, setRemove] = useState<ProxyPool | null>(null);
  const pools = useProxyPools();
  const removePool = useDeleteProxyPool();
  const test = useTestProxyPool();
  const toast = useToast();
  const fail = (error: unknown) => toast({ tone: "error", error });
  const rows = pools.data ?? [];
  const readProblem = pools.isError ? toProblem(pools.error, language) : null;
  return <><PageHeading eyebrow={t("proxy.eyebrow")} title={t("proxy.title")} description={t("proxy.description")} action={<Link className="button button-primary" to="/network/proxy-pools/deploy">{t("proxy.deployLink")}</Link>} />
    <Warning>{t("proxy.strictWarning")}</Warning>
    <Panel title={t("proxy.configured")} detail={t("proxy.configuredDetail")} action={<Button variant="primary" onClick={() => setEditing("new")}>{t("proxy.add")}</Button>} className="section-gap panel-flush">
      {pools.isPending ? <StateBlock state="loading" /> : readProblem ? <div className="state-block error"><code>{readProblem.code}</code><strong>{t("proxy.loadFailed")}</strong><p>{readProblem.message}</p><Button onClick={() => void pools.refetch()}>{t("common.retry")}</Button></div>
        : <Table empty={t("proxy.empty")} columns={[t("proxy.pool"), t("proxy.type"), t("proxy.connections"), t("proxy.strict"), t("proxy.health"), ""]} rows={rows.map((pool) => [
          <div><strong>{pool.name}</strong><small className="muted"> · {pool.isActive ? t("proxy.enabled") : t("proxy.disabled")}</small></div>, <code>{pool.type}</code>, <span className="mono">{pool.boundConnectionCount}</span>,
          <Pill tone={pool.strictProxy ? "info" : "muted"}>{pool.strictProxy ? t("proxy.on") : t("proxy.off")}</Pill>,
          <Pill tone={pool.testStatus === "active" ? "healthy" : pool.testStatus === "error" ? "danger" : "muted"}>{t(`proxy.health.${pool.testStatus}`)}</Pill>,
          <><Button variant="ghost" disabled={test.isPending} onClick={() => test.mutate(pool.id, { onSuccess: (value) => toast({ tone: value.ok ? "success" : "error", localized: { key: value.ok ? "proxy.reachable" : "proxy.probeFailed", params: { name: pool.name, detail: value.error ?? "" } } }), onError: fail })}>{test.isPending && test.variables === pool.id ? t("proxy.testing") : t("proxy.test")}</Button><Button variant="ghost" onClick={() => setEditing(pool)}>{t("proxy.manage")}</Button><Button variant="ghost" onClick={() => setRemove(pool)}>{t("proxy.delete")}</Button></>,
        ])} />}
    </Panel>
    <NoAuthRotations pools={rows.filter((pool) => pool.isActive)} poolsReady={pools.isSuccess} />
    {editing && <ProxyPoolForm pool={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    {remove && <ConfirmDialog name={remove.name} detail={remove.boundConnectionCount ? t("proxy.deleteBlocked") : undefined} pending={removePool.isPending} onClose={() => { if (!removePool.isPending) setRemove(null); }} onConfirm={() => removePool.mutate(remove.id, { onSuccess: () => { setRemove(null); toast({ tone: "success", localized: { key: "proxy.deleted", params: { name: remove.name } } }); }, onError: fail })} />}
  </>;
}

function NoAuthRotations({ pools, poolsReady }: { pools: ProxyPool[]; poolsReady: boolean }) {
  const { language, t } = useLocale();
  const rotations = useProxyRotations();
  const update = useUpdateProxyRotation();
  const toast = useToast();
  const problem = rotations.isError ? toProblem(rotations.error, language) : null;
  const save = (rotation: ProxyRotation, rotateStrategy: ProxyRotation["rotateStrategy"], proxyPoolId: string | null) => update.mutate(
    { providerId: rotation.providerId, rotateStrategy, proxyPoolId },
    { onSuccess: () => toast({ tone: "success", localized: { key: "proxy.strategySaved", params: { name: rotation.name } } }), onError: (error) => toast({ tone: "error", error }) },
  );
  return <Panel title={t("proxy.keylessTitle")} detail={t("proxy.keylessDetail")} className="section-gap">
    {rotations.isPending ? <StateBlock state="loading" /> : problem ? <div className="state-block error"><code>{problem.code}</code><strong>{t("proxy.rotationsFailed")}</strong><p>{problem.message}</p><Button onClick={() => void rotations.refetch()}>{t("common.retry")}</Button></div>
      : rotations.data?.length ? <div className="stack">{rotations.data.map((rotation) => <div className="list-row" key={rotation.providerId}><div><strong>{rotation.name}</strong><small><code>{rotation.providerId}</code></small></div><div className="row"><Field label={t("proxy.strategy")}><select className="input" value={rotation.rotateStrategy} disabled={update.isPending || !poolsReady} onChange={(event) => { const value = event.target.value; if (value === "none" || value === "round-robin" || value === "random") save(rotation, value, rotation.proxyPoolId); }}><option value="none">{t("proxy.fixed")}</option><option value="round-robin">{t("proxy.roundRobin")}</option><option value="random">{t("proxy.random")}</option></select></Field><Field label={t("proxy.pool")}><select className="input" value={rotation.proxyPoolId ?? ""} disabled={update.isPending || !poolsReady || rotation.rotateStrategy !== "none"} onChange={(event) => save(rotation, rotation.rotateStrategy, event.target.value || null)}><option value="">{t("proxy.direct")}</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.type})</option>)}</select></Field></div></div>)}</div>
        : <p className="muted">{t("proxy.noKeyless")}</p>}
  </Panel>;
}

function ProxyPoolForm({ pool, onClose }: { pool?: ProxyPool; onClose: () => void }) {
  const { t } = useLocale();
  const create = useCreateProxyPool();
  const update = useUpdateProxyPool();
  const toast = useToast();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const type = (["http", "vercel", "cloudflare", "deno"] as const).find((candidate) => candidate === value("type")) ?? "http";
    const body = { name: value("name"), proxyUrl: value("proxyUrl"), noProxy: value("noProxy"), type, isActive: form.get("isActive") === "on", strictProxy: form.get("strictProxy") === "on" };
    const done = () => { toast({ tone: "success", localized: { key: pool ? "proxy.updated" : "proxy.added", params: { name: body.name } } }); onClose(); };
    const fail = (error: unknown) => toast({ tone: "error", error });
    if (pool) update.mutate({ id: pool.id, ...body }, { onSuccess: done, onError: fail }); else create.mutate(body, { onSuccess: done, onError: fail });
  };
  return <Modal title={pool ? t("proxy.manageNamed", { name: pool.name }) : t("proxy.addTitle")} onClose={onClose}><form onSubmit={submit} className="stack"><Field label={t("proxy.name")}><Input name="name" defaultValue={pool?.name} required maxLength={64} /></Field><Field label={t("proxy.type")}><select className="input" name="type" defaultValue={pool?.type ?? "http"}><option value="http">{t("proxy.type.http")}</option><option value="vercel">{t("proxy.type.vercel")}</option><option value="cloudflare">{t("proxy.type.cloudflare")}</option><option value="deno">{t("proxy.type.deno")}</option></select></Field><Field label={t("proxy.url")} hint={t("proxy.urlHint")}><Input name="proxyUrl" defaultValue={pool?.proxyUrl} required maxLength={2048} placeholder="https://proxy.example.com" /></Field><Field label={t("proxy.noProxy")} hint={t("proxy.noProxyHint")}><Input name="noProxy" defaultValue={pool?.noProxy} maxLength={1024} placeholder="localhost,.internal.example" /></Field><label className="choice-card"><input name="isActive" type="checkbox" defaultChecked={pool?.isActive ?? true} /> {t("proxy.enablePool")}</label><label className="choice-card"><input name="strictProxy" type="checkbox" defaultChecked={pool?.strictProxy ?? false} /> {t("proxy.failClosed")}</label><div className="modal-actions"><Button onClick={onClose} disabled={create.isPending || update.isPending}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? t("proxy.saving") : t("proxy.save")}</Button></div></form></Modal>;
}

export function DeployWizard() {
  const { t } = useLocale();
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
    onSuccess: (result: { deployUrl: string }) => { setToken(""); toast({ tone: "success" as const, localized: { key: "proxy.deployed" as const, params: { url: result.deployUrl } } }); },
    onError: (error: unknown) => toast({ tone: "error" as const, error }),
  };
  const finish = () => {
    if (platform === "vercel") vercel.mutate({ vercelToken: token, projectName }, options);
    else if (platform === "cloudflare") cloudflare.mutate({ apiToken: token, accountId, projectName }, options);
    else deno.mutate({ denoToken: token, orgDomain, projectName }, options);
  };
  const credentialsValid = token.trim().length >= 8 && (platform !== "cloudflare" || /^[a-f0-9]{32}$/i.test(accountId.trim())) && (platform !== "deno" || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:deno\.net|deno\.dev)$/i.test(orgDomain.trim()));
  const stepKeys = ["proxy.platform", "proxy.credentials", "proxy.review"] as const;
  const progressKeys = ["proxy.createRelay", "proxy.waitReady", "proxy.validateEndpoint", "proxy.attachPool"] as const;
  return <><PageHeading eyebrow={t("proxy.deployEyebrow")} title={t("proxy.deployTitle")} description={t("proxy.deployDescription")} />
    <div className="wizard-steps">{stepKeys.map((key, i) => <div key={key} className={step === i + 1 ? "active" : ""}><span>{i + 1}</span>{t(key)}</div>)}</div>
    <div className="split section-gap"><Panel title={t(step === 1 ? "proxy.choosePlatform" : step === 2 ? "proxy.deployCredentials" : "proxy.reviewDeployment")}>
        {step === 1 && <div className="stack">{([["vercel", "proxy.vercelLabel", "proxy.vercelDetail"], ["cloudflare", "proxy.cloudflareLabel", "proxy.cloudflareDetail"], ["deno", "proxy.denoLabel", "proxy.denoDetail"]] as const).map(([value, label, detail]) => <label key={value} className="choice-card"><input type="radio" name="platform" checked={platform === value} onChange={() => { setPlatform(value); setToken(""); }} /> {t(label)} <small>{t(detail)}</small></label>)}</div>}
        {step === 2 && <div className="stack"><Field label={t(platform === "vercel" ? "proxy.vercelToken" : platform === "cloudflare" ? "proxy.cloudflareToken" : "proxy.denoToken")}><input className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={t("proxy.pasteToken")} autoComplete="off" /></Field>{platform === "cloudflare" && <Field label={t("proxy.cloudflareAccount")}><input className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder={t("proxy.accountHint")} autoComplete="off" /></Field>}{platform === "deno" && <Field label={t("proxy.denoDomain")} hint={t("proxy.denoDomainHint")}><input className="input" value={orgDomain} onChange={(event) => setOrgDomain(event.target.value)} placeholder="team.deno.net" autoComplete="off" /></Field>}<Field label={t("proxy.projectName")}><input className="input" value={projectName} maxLength={64} onChange={(event) => setProjectName(event.target.value)} placeholder="aigate-relay" /></Field><Warning>{t("proxy.tokenPrivacy")}</Warning></div>}
        {step === 3 && <div className="stack"><div className="list-row"><div><strong>{t("proxy.platform")}</strong><small>{t(platform === "vercel" ? "proxy.vercelLabel" : platform === "cloudflare" ? "proxy.cloudflareLabel" : "proxy.denoLabel")}</small></div><Pill tone="info">{t("proxy.selected")}</Pill></div><div className="list-row"><div><strong>{t("proxy.policy")}</strong><small>{t("proxy.policyDetail")}</small></div><Pill tone="healthy">{t("proxy.safe")}</Pill></div></div>}
        <div className="modal-actions"><Button disabled={step === 1 || pending} onClick={() => setStep(Math.max(1, step - 1))}>{t("proxy.back")}</Button><Button variant="primary" disabled={pending || (step === 2 && !credentialsValid)} onClick={() => step === 3 ? finish() : setStep(Math.min(3, step + 1))}>{pending ? t("proxy.deploying") : step === 3 ? t("proxy.deploy") : t("proxy.continue")}</Button></div>
      </Panel><Panel title={t("proxy.deploymentState")}><div className="flow-steps">{progressKeys.map((key, i) => <div key={key}><span>{String(i + 1).padStart(2, "0")}</span><strong>{t(key)}</strong><Pill>{step === 3 && i === 0 ? t("proxy.ready") : t("proxy.pending")}</Pill></div>)}</div></Panel></div>
  </>;
}
