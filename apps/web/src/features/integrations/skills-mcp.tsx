import { useState, type FormEvent } from "react";
import { Button, ConfirmDialog, CopyField, Field, Modal, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { useToast } from "../../shared/toast";
import { useCreateMcpServer, useDeleteMcpServer, useMcpMarketplace, useMcpServers, useUpdateMcpServer, type McpServer } from "./api";

const skills = [
  ["9router", "skills.entry", "skills.entryPurpose", null],
  ["9router-chat", "skills.chat", "skills.chatPurpose", "/v1/chat/completions"],
  ["9router-image", "skills.image", "skills.imagePurpose", "/v1/images/generations"],
  ["9router-tts", "skills.tts", "skills.ttsPurpose", "/v1/audio/speech"],
  ["9router-stt", "skills.stt", "skills.sttPurpose", "/v1/audio/transcriptions"],
  ["9router-embeddings", "skills.embeddings", "skills.embeddingsPurpose", "/v1/embeddings"],
  ["9router-web-search", "skills.webSearch", "skills.webSearchPurpose", "/v1/search"],
  ["9router-web-fetch", "skills.webFetch", "skills.webFetchPurpose", "/v1/web/fetch"],
] as const;

export function Skills() {
  const { t } = useLocale();
  const rawUrl = (id: string) => `https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/${id}/SKILL.md`;
  return <><PageHeading eyebrow={t("skills.eyebrow")} title={t("skills.title")} description={t("skills.description")} />
    <Warning>{t("skills.warning")}</Warning>
    <Panel title={t("skills.available")} detail={t("skills.availableDetail")} className="panel-flush"><Table columns={[t("skills.columnSkill"), t("skills.columnPurpose"), t("skills.columnEndpoint"), t("skills.columnUrl")]} rows={skills.map(([id, name, purpose, endpoint]) => [<strong>{t(name)}</strong>, t(purpose), endpoint ? <code>{endpoint}</code> : <Pill tone="info">{t("skills.startHere")}</Pill>, <CopyField value={rawUrl(id)} />])} /></Panel>
  </>;
}

type McpTab = "servers" | "marketplace" | "storage";
export function Mcp() {
  const { language, t } = useLocale();
  const [tab, setTab] = useState<McpTab>("servers");
  const [exportClient, setExportClient] = useState<"claude" | "cursor">("claude");
  const [editing, setEditing] = useState<McpServer | "new" | null>(null);
  const [remove, setRemove] = useState<McpServer | null>(null);
  const servers = useMcpServers();
  const marketplace = useMcpMarketplace();
  const create = useCreateMcpServer();
  const update = useUpdateMcpServer();
  const deletion = useDeleteMcpServer();
  const toast = useToast();
  const busy = create.isPending || update.isPending || deletion.isPending;
  const fail = (error: unknown) => toast({ tone: "error", error });
  const exportServers = (servers.data ?? []).filter((server) => server.enabled);
  const exportConfig = JSON.stringify({ mcpServers: Object.fromEntries(exportServers.map((server) => [server.name, exportClient === "claude" ? { type: "http", url: server.url } : { url: server.url }])) }, null, 2);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const scope: McpServer["scope"] = form.get("scope") === "project" ? "project" : "user";
    const input = { name: String(form.get("name") ?? ""), url: String(form.get("url") ?? ""), scope };
    if (editing === "new") create.mutate(input, { onSuccess: () => { setEditing(null); toast({ tone: "success", localized: { key: "mcp.saved" } }); }, onError: fail });
    else if (editing) update.mutate({ id: editing.id, ...input }, { onSuccess: () => { setEditing(null); toast({ tone: "success", localized: { key: "mcp.updated" } }); }, onError: fail });
  };
  const readError = (error: unknown, retry: () => void) => { const problem = toProblem(error, language); return <div className="state-block error"><code>{problem.code}</code><strong>{t("common.loadFailed")}</strong><p>{problem.message}</p><Button onClick={retry}>{t("common.retry")}</Button></div>; };
  return <><PageHeading eyebrow={t("mcp.eyebrow")} title={t("mcp.title")} description={t("mcp.description")} action={<Button variant="primary" disabled={busy} onClick={() => setEditing("new")}>{t("mcp.addServer")}</Button>} />
    <Warning>{t("mcp.warning")}</Warning>
    <Tabs items={["servers", "marketplace", "storage"]} active={tab} onChange={(value) => { if (value === "servers" || value === "marketplace" || value === "storage") setTab(value); }} getLabel={(value) => t(value === "servers" ? "mcp.tabServers" : value === "marketplace" ? "mcp.tabMarketplace" : "mcp.tabStorage")} />
    {tab === "servers" && <Panel title={t("mcp.savedServers")} detail={t("mcp.savedDetail")} className="section-gap panel-flush">
      {servers.isPending ? <StateBlock state="loading" /> : servers.isError ? readError(servers.error, () => void servers.refetch())
        : <Table empty={t("mcp.emptyServers")} columns={[t("mcp.columnServer"), t("mcp.columnEndpoint"), t("mcp.columnScope"), t("mcp.columnState"), ""]} rows={(servers.data ?? []).map((server) => [<strong>{server.name}</strong>, <code>{server.url}</code>, t(server.scope === "user" ? "mcp.scopeUser" : "mcp.scopeProject"), <Pill tone={server.enabled ? "info" : "muted"}>{t(server.enabled ? "mcp.savedState" : "mcp.pausedState")}</Pill>, <><Button variant="ghost" disabled={busy} onClick={() => update.mutate({ id: server.id, enabled: !server.enabled }, { onError: fail })}>{t(server.enabled ? "mcp.pause" : "mcp.enable")}</Button><Button variant="ghost" disabled={busy} onClick={() => setEditing(server)}>{t("mcp.edit")}</Button><Button variant="ghost" disabled={busy} onClick={() => setRemove(server)}>{t("mcp.delete")}</Button></>])} />}
    </Panel>}
    {tab === "marketplace" && <Panel title={t("mcp.marketplace")} detail={t("mcp.marketplaceDetail")} className="section-gap panel-flush">{marketplace.isPending ? <StateBlock state="loading" /> : marketplace.isError ? readError(marketplace.error, () => void marketplace.refetch()) : <Table empty={t("mcp.emptyMarketplace")} columns={[t("mcp.columnServer"), t("mcp.columnDescription"), t("mcp.columnTransport"), ""]} rows={(marketplace.data?.servers ?? []).map((server) => [<strong>{server.title}</strong>, <span>{server.description || server.url}</span>, <Pill tone={server.requiresAuth ? "info" : "healthy"}>{server.requiresAuth ? "OAuth" : server.transport}</Pill>, <Button variant="ghost" disabled={busy || (servers.data ?? []).some((saved) => saved.name.toLowerCase() === server.name.toLowerCase())} onClick={() => create.mutate({ name: server.name, url: server.url, scope: "user" }, { onSuccess: () => toast({ tone: "success", localized: { key: "mcp.savedName", params: { name: server.title } } }), onError: fail })}>{t("mcp.add")}</Button>])} />}</Panel>}
    {tab === "storage" && <div className="stack section-gap"><Panel title={t("mcp.storageTitle")}><p>{t("mcp.storageDescription")} <code>mcp-servers.json</code> {t("mcp.storageLocation")} <code>AIGATE_DATA_DIR</code> {t("mcp.storageSafety")}</p></Panel>
      <Panel title={t("mcp.copyConfig")} detail={t("mcp.copyDetail")}><div className="stack"><Field label={t("mcp.client")}><select className="input" value={exportClient} onChange={(event) => setExportClient(event.target.value === "cursor" ? "cursor" : "claude")}><option value="claude">Claude Code</option><option value="cursor">Cursor</option></select></Field>
        {servers.isError ? readError(servers.error, () => void servers.refetch()) : servers.isPending ? <StateBlock state="loading" /> : exportServers.length ? <><pre className="code-block">{exportConfig}</pre><Button onClick={() => void navigator.clipboard.writeText(exportConfig).then(() => toast({ tone: "success", localized: { key: "mcp.copied" } }), () => toast({ tone: "error", localized: { key: "mcp.copyDenied" } }))}>{t("mcp.copyJson")}</Button></> : <p className="muted">{t("mcp.enableHint")}</p>}
        <Warning>{t("mcp.clientWarning")}</Warning>
      </div></Panel></div>}
    {editing && <Modal title={editing === "new" ? t("mcp.addTitle") : t("mcp.editTitle", { name: editing.name })} onClose={() => { if (!busy) setEditing(null); }}><form onSubmit={submit} className="stack"><Field label={t("mcp.name")}><input className="input" name="name" defaultValue={editing === "new" ? "" : editing.name} maxLength={64} required /></Field><Field label={t("mcp.serverUrl")} hint={t("mcp.urlHint")}><input className="input" name="url" type="url" defaultValue={editing === "new" ? "" : editing.url} maxLength={2048} required /></Field><Field label={t("mcp.scope")}><select className="input" name="scope" defaultValue={editing === "new" ? "user" : editing.scope}><option value="user">{t("mcp.scopeUser")}</option><option value="project">{t("mcp.scopeProject")}</option></select></Field><div className="modal-actions"><Button onClick={() => setEditing(null)} disabled={busy}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? t("mcp.saving") : t("mcp.saveServer")}</Button></div></form></Modal>}
    {remove && <ConfirmDialog name={remove.name} detail={t("mcp.removeDetail")} pending={busy} onClose={() => { if (!busy) setRemove(null); }} onConfirm={() => { if (busy) return; deletion.mutate(remove.id, { onSuccess: () => { setRemove(null); toast({ tone: "success", localized: { key: "mcp.removed", params: { name: remove.name } } }); }, onError: fail }); }} />}
  </>;
}
