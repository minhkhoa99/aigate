import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, ConfirmDialog, Field, Input, PageHeading, Panel, Pill, StateBlock } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useConnections, useCreateNode, useDeleteNode, useProviderNodes, useProviders, useUpdateNode, type ApiType, type NodeType, type ProviderNode, type ThinkingLevel } from "./api";
import { ProviderModels } from "./models";
import { headerPayload, NODE_THINKING_LEVELS, unreachable, type HeaderRow } from "./node-rules";
import { statusPill, STATUS_KEYS } from "./test-result";

// docs/contracts/custom-providers.md: user-defined OpenAI- or Anthropic-compatible endpoints, reached as "<prefix>/<model>".

const PROTOCOLS: Readonly<Record<NodeType, { label: string; hint: string; placeholder: string; test: string }>> = {
  "openai-compatible": {
    label: "OpenAI compatible",
    hint: "The upstream API URL before /chat/completions or /responses, not this AIGate gateway URL. Empty means https://api.openai.com/v1. https, or http to this machine only.",
    placeholder: "https://api.example.com/v1",
    test: "Add its API key; AIGate tests it at <base URL>/models",
  },
  "anthropic-compatible": {
    label: "Anthropic compatible",
    hint: "The upstream API URL before /messages, not this AIGate gateway URL (a pasted /messages is removed). Empty means https://api.anthropic.com/v1. https, or http to this machine only.",
    placeholder: "https://api.anthropic.com/v1",
    // connection.anthropic-compatible-node: kept as 9router tests it.
    test: "Add its API key; like 9router, the test posts to <base URL>/v1/messages and accepts any answer except 401/403",
  },
};
// The server's bound (docs/contracts/custom-providers.md).
const MAX_HEADERS = 20;
const typeParam = (value: string | null): NodeType => (value === "anthropic-compatible" ? value : "openai-compatible");
// connection.provider-node-api-type: which OpenAI API an OpenAI-compatible provider speaks.
const API_TYPES: Readonly<Record<ApiType, string>> = { chat: "Chat completions (/chat/completions)", responses: "Responses (/responses)" };
const apiTypeParam = (value: string): ApiType | undefined => (value === "chat" || value === "responses" ? value : undefined);
const protocolLabel = (node: ProviderNode, translate?: (key: "providers.openaiCompatible" | "providers.anthropicCompatible" | "providers.apiResponses") => string) => `${node.type === "openai-compatible" ? translate?.("providers.openaiCompatible") ?? PROTOCOLS[node.type].label : translate?.("providers.anthropicCompatible") ?? PROTOCOLS[node.type].label}${node.apiType === "responses" ? ` · ${translate?.("providers.apiResponses") ?? "Responses"}` : ""}`;

const text = (form: HTMLFormElement, name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
};
const connectHref = (id: string) => `/providers/connections?provider=${encodeURIComponent(id)}`;
const detailHref = (id: string) => `/providers/detail?provider=${encodeURIComponent(id)}`;

// docs/contracts/custom-models.md: a custom provider declares no models, so the ones to call are imported from its
// /models or added by hand.
export function CustomProviderDetail({ node }: { node: ProviderNode }) {
  const { t } = useLocale();
  const connections = useConnections();
  const connection = connections.data?.find((c) => c.provider === node.id);
  const pill = connection && statusPill(connection);
  return <><PageHeading eyebrow={`${t("providers.catalogEyebrow").split(" /")[0]} / ${t("providers.custom")}`} title={node.name} description={t("providers.customCalled", { prefix: node.prefix })} action={<a className="button" href={`/providers/new?id=${encodeURIComponent(node.id)}`}>{t("providers.edit")}</a>} />
    <div className="grid grid-2"><Panel title={t("providers.providerType")}><Pill tone="info">{protocolLabel(node, t)}</Pill><p className="muted">{t("providers.customProvider")} · {t("providers.prefix")} <code>{node.prefix}</code></p><p className="muted" style={{ overflowWrap: "anywhere" }}>{t("providers.baseUrl")} <code>{node.baseUrl}</code></p>
      <p className="muted">{t("providers.customHeaders")} {node.customHeaders.length === 0 ? t("providers.none") : node.customHeaders.map((header) => <code key={header.name}>{header.name}</code>)} · {t("providers.retryStream")} {node.retryStreamErrors ? t("providers.retryOn") : t("providers.retryOff")} · {t("providers.thinking")} {node.thinking}</p></Panel>
      <Panel title="Connection">{connections.isPending ? <StateBlock state="loading" />
        : connections.isError ? <StateBlock state="error" code={toProblem(connections.error).code} action={<Button onClick={() => void connections.refetch()}>Retry</Button>} />
         : connection && pill ? <div className="list-row"><div><strong>{connection.name}</strong><small>{t("providers.key")} <code>{connection.keyHint}</code></small></div><Pill tone={pill.tone}>{connection.isActive ? t(STATUS_KEYS[connection.testStatus]) : t("providers.statusDisabled")}</Pill><a className="button" href="/providers/connections">{t("providers.manage")}</a></div>
         : <div className="state-block"><strong>{t("providers.notConnected")}</strong><p>{t("providers.notConnectedModels")}</p><a className="button button-primary" href={connectHref(node.id)}>{t("providers.addConnection")}</a></div>}</Panel></div>
    <ProviderModels providerId={node.id} prefix={node.prefix} catalog={[]} thinking={node.thinking} everyModelReasons />
  </>;
}

export function CustomProviders() {
  const { t } = useLocale();
  const nodes = useProviderNodes();
  const connections = useConnections();
  const catalog = useProviders();
  const reserved = new Set((catalog.data ?? []).flatMap((p) => [p.id, ...p.aliases]));
  const remove = useDeleteNode();
  const showToast = useToast();
  const [removing, setRemoving] = useState<ProviderNode | null>(null);
  const connected = new Set(connections.data?.map((c) => c.provider));
  return <section className="catalog-section"><div className="catalog-section-head"><div><h2>{t("providers.customSection")} {nodes.data && <span className="muted mono">{nodes.data.length}</span>}</h2><p>{t("providers.customDescription")}</p></div><div className="row"><a className="button" href="/providers/new?type=anthropic-compatible">+ {t("providers.anthropicCompatible")}</a><a className="button button-primary" href="/providers/new">+ {t("providers.openaiCompatible")}</a></div></div>
    {nodes.isPending ? <StateBlock state="loading" />
      : nodes.isError ? <StateBlock state="error" code={toProblem(nodes.error).code} action={<Button onClick={() => void nodes.refetch()}>Retry</Button>} />
       : nodes.data.length === 0 ? <div className="catalog-empty">{t("providers.noCustom")}</div>
       : <div className="catalog-grid">{nodes.data.map((node) => <div className="catalog-card" key={node.id}><span className="catalog-glyph" aria-hidden="true">{node.name.slice(0, 1)}</span><span className="catalog-card-copy"><strong>{node.name}</strong><small><code>{node.prefix}/…</code> · {protocolLabel(node, t)}</small><small title={node.baseUrl} style={{ overflowWrap: "anywhere" }}>{node.baseUrl}</small>
         {(() => { const reason = unreachable(node, nodes.data, reserved); return reason && <><Pill tone="warning">{t("providers.unreachable")}</Pill><small>{reason}</small></>; })()}
         {connected.has(node.id) ? <Pill tone="healthy">{t("providers.connected")}</Pill> : <a className="button button-ghost" href={connectHref(node.id)}>{t("providers.connect")}</a>}
         <a className="button button-ghost" href={detailHref(node.id)}>{t("providers.models")}</a>
         <a className="button button-ghost" href={`/providers/new?id=${encodeURIComponent(node.id)}`}>{t("providers.edit")}</a><Button variant="ghost" onClick={() => setRemoving(node)}>{t("providers.delete")}</Button></span></div>)}</div>}
     {removing && <ConfirmDialog name={removing.name} detail={connected.has(removing.id) ? t("providers.removeConnectionToo") : undefined} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing.id, {
       onSuccess: () => { setRemoving(null); showToast({ tone: "success", message: t("providers.deleted", { name: removing.name }) }); },
      onError: (error) => { setRemoving(null); showToast({ tone: "error", ...toProblem(error) }); },
    })} />}
  </section>;
}

// docs/contracts/custom-providers.md: headers sent with every request to the provider. A saved value is never shown;
// leaving it empty keeps it.
function HeaderRows({ rows, onChange }: { rows: HeaderRow[]; onChange: (rows: HeaderRow[]) => void }) {
  const { t } = useLocale();
  const set = (id: number, change: Partial<HeaderRow>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const add = () => onChange([...rows, { id: Math.max(0, ...rows.map((row) => row.id)) + 1, name: "", value: "" }]);
  return <div className="stack">
    {rows.map((row) => <div className="row" key={row.id}>
       <input className="input" aria-label={t("providers.headerName")} maxLength={64} value={row.name} placeholder="X-Custom-Header" onChange={(event) => set(row.id, { name: event.target.value })} />
       <input className="input" aria-label={t("providers.headerValue", { header: row.name || "the header" })} type="password" autoComplete="off" maxLength={2048} value={row.value}
         placeholder={row.hint ? t("providers.headerUnchanged", { hint: row.hint }) : t("providers.headerValuePlaceholder")} onChange={(event) => set(row.id, { value: event.target.value })} />
       <Button variant="ghost" onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>{t("providers.remove")}</Button>
    </div>)}
     <div className="row"><Button onClick={add} disabled={rows.length >= MAX_HEADERS}>{t("providers.addHeader")}</Button>{rows.length >= MAX_HEADERS && <small className="muted">{t("providers.maxHeaders", { count: MAX_HEADERS })}</small>}</div>
  </div>;
}

function NodeForm({ node, type, onType }: { node?: ProviderNode; type: NodeType; onType?: (type: NodeType) => void }) {
  const { t } = useLocale();
  const create = useCreateNode();
  const update = useUpdateNode();
  const showToast = useToast();
  const [headers, setHeaders] = useState<HeaderRow[]>(() => (node?.customHeaders ?? []).map((header, index) => ({ id: index + 1, name: header.name, value: "", hint: header.hint })));
  const [retry, setRetry] = useState(node?.retryStreamErrors ?? false);
  const [thinking, setThinking] = useState<ThinkingLevel | "auto">(node?.thinking ?? "auto");
  const levels = node?.thinkingLevels ?? NODE_THINKING_LEVELS[type];
  const pending = create.isPending || update.isPending;
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const baseUrl = text(event.currentTarget, "baseUrl");
    // An empty base URL is left out, so the server applies the 9router default.
    const apiType = type === "openai-compatible" ? apiTypeParam(text(event.currentTarget, "apiType")) : undefined;
    const fields = {
      name: text(event.currentTarget, "name"), prefix: text(event.currentTarget, "prefix"), ...(baseUrl ? { baseUrl } : {}), ...(apiType ? { apiType } : {}),
      // A level the chosen protocol does not take (after a protocol change) is sent as Auto, as the select shows it.
      customHeaders: headerPayload(headers), retryStreamErrors: retry, thinking: levels.some((level) => level === thinking) ? thinking : "auto",
    };
    // A new provider goes straight to its API key; an edit applies to the existing connection at once.
    if (!node) create.mutate({ ...fields, type }, { onSuccess: (created) => window.location.assign(connectHref(created.id)), onError: fail });
    else update.mutate({ id: node.id, ...fields }, { onSuccess: () => window.location.assign("/providers"), onError: fail });
  };
  const protocolText = type === "openai-compatible" ? t("providers.openaiCompatible") : t("providers.anthropicCompatible");
  const protocolHint = type === "openai-compatible" ? t("providers.openaiHint") : t("providers.anthropicHint");
  return <form onSubmit={submit}><div className="stack">
    <Field label={t("providers.providerName")}><Input name="name" required maxLength={64} defaultValue={node?.name} placeholder={t("providers.localLlm")} /></Field>
    <Field label={t("providers.prefix")} hint={t("providers.prefixHint")}><Input name="prefix" required maxLength={200} defaultValue={node?.prefix} placeholder="local" /></Field>
    <Field label={t("providers.protocol")} hint={node ? t("providers.protocolFixed") : undefined}><select className="input" name="type" value={type} onChange={(event) => onType?.(typeParam(event.target.value))} disabled={Boolean(node)}>{Object.entries(PROTOCOLS).map(([value]) => <option key={value} value={value}>{value === type ? protocolText : value === "openai-compatible" ? t("providers.openaiCompatible") : t("providers.anthropicCompatible")}</option>)}</select></Field>
    {type === "openai-compatible" && <Field label={t("providers.api")} hint={t("providers.responsesHint")}><select className="input" name="apiType" defaultValue={node?.apiType ?? "chat"}>{Object.entries(API_TYPES).map(([value]) => <option key={value} value={value}>{value === "chat" ? t("providers.apiChat") : t("providers.apiResponses")}</option>)}</select></Field>}
    <Field label={t("providers.baseUrl")} hint={protocolHint}><Input name="baseUrl" maxLength={2048} defaultValue={node?.baseUrl} placeholder={PROTOCOLS[type].placeholder} /></Field>
    {/* Several controls, so a group rather than the single-control Field label. */}
    <div className="field" role="group" aria-label={t("providers.customHeaders")}><span>{t("providers.customHeaders")}</span><HeaderRows rows={headers} onChange={setHeaders} />
      <small>{t("providers.headersHint")}</small></div>
    <Field label={t("providers.defaultThinking")} hint={t("providers.customThinkingHint")}>
      <select className="input" value={levels.some((level) => level === thinking) ? thinking : "auto"} onChange={(event) => { const value = event.target.value; const next = value === "auto" ? "auto" : levels.find((level) => level === value); if (next) setThinking(next); }}>
         <option value="auto">{t("providers.auto")}</option>{levels.map((level) => <option key={level} value={level}>{level === "xhigh" ? t("providers.extraHigh") : level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
       </select></Field>
    <div className="list-row"><div><strong>{t("providers.retryStream")}</strong><small>{t("providers.retryStreamHint")}</small></div>
      <input type="checkbox" checked={retry} onChange={(event) => setRetry(event.target.checked)} aria-label={t("providers.retryStream")} /></div>
    <div className="row"><Link className="button" to="/providers">{t("providers.cancel")}</Link><Button type="submit" variant="primary" disabled={pending}>{pending ? t("providers.saving") : node ? t("providers.saveChanges") : t("providers.saveAndAddKey")}</Button></div>
  </div></form>;
}

export function CustomProviderForm() {
  const { t } = useLocale();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const [type, setType] = useState(typeParam(params.get("type")));
  const nodes = useProviderNodes();
  const steps = (type: NodeType) => <Panel title={t("providers.howWorks")}><div className="flow-steps">{[t("providers.stepSave"), type === "openai-compatible" ? t("providers.openaiTest") : t("providers.anthropicTest"), t("providers.stepCall")].map((x, i) => <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><strong>{x}</strong></div>)}</div></Panel>;
  if (!id) return <><PageHeading eyebrow={`${t("providers.catalogEyebrow").split(" /")[0]} / ${t("providers.custom")}`} title={t("providers.addCustom")} description={t("providers.customDescriptionShort")} /><div className="split section-gap"><Panel title={t("providers.providerType")}><NodeForm type={type} onType={setType} /></Panel>{steps(type)}</div></>;
  if (nodes.isPending) return <StateBlock state="loading" />;
  if (nodes.isError) return <StateBlock state="error" code={toProblem(nodes.error).code} action={<Button onClick={() => void nodes.refetch()}>Retry</Button>} />;
  const node = nodes.data.find((n) => n.id === id);
  if (!node) return <><PageHeading eyebrow={`${t("providers.catalogEyebrow").split(" /")[0]} / ${t("providers.custom")}`} title={t("providers.customNotFound")} description={t("providers.mayDeleted")} /><Link className="button" to="/providers">{t("providers.backToProviders")}</Link></>;
  return <><PageHeading eyebrow={`${t("providers.catalogEyebrow").split(" /")[0]} / ${t("providers.custom")}`} title={`${t("providers.edit")} ${node.name}`} description={t("providers.changesApply")} /><div className="split section-gap"><Panel title={t("providers.providerType")}><NodeForm node={node} type={node.type} /></Panel>{steps(node.type)}</div></>;
}
