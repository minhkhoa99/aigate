import { useRef, useState, type FormEvent } from "react";
import { Button, CopyField, Field, PageHeading, Panel, Pill, StateBlock, Table, Tabs, Warning } from "../../shared/ui";
import { ConfirmDialog, Modal } from "../../shared/dialog";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { useToast } from "../../shared/toast";
import {
  useCreateMcpServer, useCreateSkill, useDeleteMcpServer, useDeleteSkill, useMcpMarketplace, useMcpServers, useSkill, useSkills, useUpdateMcpServer, useUpdateSkill,
  type McpServer, type Skill, type SkillInput, type SkillPatch,
} from "./api";
import { MAX_SKILL_BYTES, MAX_SKILL_DESCRIPTION, MAX_SKILL_NAME, readFrontmatter, skillBytes, skillFileUrl } from "./skill-rules";

type SkillDraft = { name: string; description: string; source: Skill["source"]; url: string; content: string | null; fileName: string };
const emptyDraft: SkillDraft = { name: "", description: "", source: "link", url: "", content: null, fileName: "" };

export function Skills() {
  const { language, t } = useLocale();
  const skills = useSkills();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const deletion = useDeleteSkill();
  const toast = useToast();
  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft);
  const [fileError, setFileError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Skill | null>(null);
  const [remove, setRemove] = useState<Skill | null>(null);
  const pick = useRef(0);
  const detail = useSkill(viewing?.id ?? null);
  const busy = create.isPending || update.isPending || deletion.isPending;
  const fail = (error: unknown) => toast({ tone: "error", error });
  const kib = (bytes: number) => new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 }).format(bytes / 1024);
  const fetchUrl = (skill: Skill) => skill.source === "link" ? skill.url ?? "" : skillFileUrl(window.location.origin, skill.id);
  const open = (target: Skill | "new") => {
    pick.current += 1;
    setFileError(null);
    setDraft(target === "new" ? emptyDraft : { name: target.name, description: target.description, source: target.source, url: target.url ?? "", content: null, fileName: "" });
    setEditing(target);
  };
  // A slower earlier read, or one finishing after the modal reopened, must not overwrite the current draft.
  const pickFile = async (file: File | undefined) => {
    const token = ++pick.current;
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_SKILL_BYTES) { setFileError(t("skills.fileTooLarge", { kib: kib(MAX_SKILL_BYTES) })); return; }
    let text: string;
    try { text = await file.text(); } catch { if (token === pick.current) setFileError(t("skills.fileUnreadable")); return; }
    if (token !== pick.current) return;
    if (!text.trim()) { setFileError(t("skills.fileEmpty")); return; }
    if (skillBytes(text) > MAX_SKILL_BYTES) { setFileError(t("skills.fileTooLarge", { kib: kib(MAX_SKILL_BYTES) })); return; }
    const meta = readFrontmatter(text);
    setDraft((current) => ({ ...current, content: text, fileName: file.name, name: current.name || meta.name || "", description: current.description || meta.description || "" }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !editing) return;
    const { name, description } = draft;
    if (editing === "new") {
      let input: SkillInput;
      if (draft.source === "link") input = { name, description, source: "link", url: draft.url };
      else if (draft.content !== null) input = { name, description, source: "file", content: draft.content };
      else { setFileError(t("skills.fileRequired")); return; }
      create.mutate(input, { onSuccess: () => { setEditing(null); toast({ tone: "success", localized: { key: "skills.created", params: { name } } }); }, onError: fail });
      return;
    }
    const patch: SkillPatch = { name, description, ...(editing.source === "link" ? { url: draft.url } : draft.content !== null ? { content: draft.content } : {}) };
    update.mutate({ id: editing.id, ...patch }, { onSuccess: () => { setEditing(null); toast({ tone: "success", localized: { key: "skills.updated", params: { name } } }); }, onError: fail });
  };
  const readError = (error: unknown, retry: () => void) => { const problem = toProblem(error, language); return <div className="state-block error"><code>{problem.code}</code><strong>{t("common.loadFailed")}</strong><p>{problem.message}</p><Button onClick={retry}>{t("common.retry")}</Button></div>; };
  const source = editing === "new" ? draft.source : editing?.source;
  return <><PageHeading eyebrow={t("skills.eyebrow")} title={t("skills.title")} description={t("skills.description")} action={<Button variant="primary" disabled={busy} onClick={() => open("new")}>{t("skills.addSkill")}</Button>} />
    <Warning>{t("skills.warning")}</Warning>
    <Panel title={t("skills.listTitle")} detail={t("skills.listDetail")} className="section-gap panel-flush">
      {skills.isPending ? <StateBlock state="loading" /> : skills.isError ? readError(skills.error, () => void skills.refetch())
        : <Table empty={t("skills.empty")} columns={[t("skills.columnSkill"), t("skills.columnSource"), t("skills.columnState"), t("skills.columnUrl"), ""]} rows={(skills.data ?? []).map((skill) => [
          <><strong>{skill.name}</strong>{skill.description ? <p className="muted">{skill.description}</p> : null}</>,
          <Pill tone="info">{skill.source === "link" ? t("skills.sourceLink") : t("skills.sourceFileSize", { kib: kib(skill.bytes) })}</Pill>,
          <Pill tone={skill.enabled ? "healthy" : "muted"}>{t(skill.enabled ? "skills.enabledState" : "skills.disabledState")}</Pill>,
          <CopyField value={fetchUrl(skill)} />,
          <><Button variant="ghost" disabled={busy} onClick={() => update.mutate({ id: skill.id, enabled: !skill.enabled }, { onError: fail })}>{t(skill.enabled ? "skills.disable" : "skills.enable")}</Button>
            {skill.source === "file" && <Button variant="ghost" onClick={() => setViewing(skill)}>{t("skills.view")}</Button>}
            <Button variant="ghost" disabled={busy} onClick={() => open(skill)}>{t("skills.edit")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRemove(skill)}>{t("skills.delete")}</Button></>,
        ])} />}
    </Panel>
    {editing && <Modal title={editing === "new" ? t("skills.addTitle") : t("skills.editTitle", { name: editing.name })} onClose={() => { if (!busy) setEditing(null); }}><form onSubmit={submit} className="stack">
      {editing === "new" && <Field label={t("skills.source")}><select className="input" value={draft.source} disabled={busy} onChange={(event) => { const next = event.target.value === "file" ? "file" : "link"; setFileError(null); setDraft((current) => ({ ...current, source: next })); }}><option value="link">{t("skills.sourceLink")}</option><option value="file">{t("skills.sourceFile")}</option></select></Field>}
      {source === "link"
        ? <Field label={t("skills.url")} hint={t("skills.urlHint")}><input className="input" type="url" value={draft.url} maxLength={2048} required disabled={busy} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} /></Field>
        : <Field label={t("skills.file")} hint={editing === "new" ? t("skills.fileHint", { kib: kib(MAX_SKILL_BYTES) }) : t("skills.replaceHint", { kib: kib(MAX_SKILL_BYTES) })}><input className="input" type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={busy} onChange={(event) => void pickFile(event.currentTarget.files?.[0])} /></Field>}
      {source === "file" && draft.content !== null && <p className="muted">{t("skills.fileChosen", { name: draft.fileName, kib: kib(skillBytes(draft.content)) })}</p>}
      {fileError && <Warning tone="danger">{fileError}</Warning>}
      <Field label={t("skills.name")} hint={t("skills.nameHint")}><input className="input" value={draft.name} maxLength={MAX_SKILL_NAME} required disabled={busy} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
      <Field label={t("skills.descriptionLabel")}><textarea className="input" value={draft.description} maxLength={MAX_SKILL_DESCRIPTION} rows={3} disabled={busy} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></Field>
      <div className="modal-actions"><Button onClick={() => setEditing(null)} disabled={busy}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? t("skills.saving") : t("skills.save")}</Button></div>
    </form></Modal>}
    {viewing && <Modal title={t("skills.viewTitle", { name: viewing.name })} onClose={() => setViewing(null)}><div className="stack">
      <CopyField label={t("skills.fetchCommand")} value={`curl -H "Authorization: Bearer $AIGATE_KEY" ${fetchUrl(viewing)}`} />
      <p className="muted">{t("skills.fetchHint")}</p>
      {detail.isPending ? <StateBlock state="loading" /> : detail.isError ? readError(detail.error, () => void detail.refetch()) : <pre className="code-block">{detail.data.content ?? ""}</pre>}
    </div></Modal>}
    {remove && <ConfirmDialog name={remove.name} detail={t("skills.removeDetail")} pending={busy} onClose={() => { if (!busy) setRemove(null); }} onConfirm={() => { if (busy) return; deletion.mutate(remove.id, { onSuccess: () => { setRemove(null); toast({ tone: "success", localized: { key: "skills.removed", params: { name: remove.name } } }); }, onError: fail }); }} />}
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
