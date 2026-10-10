import { useState, type FormEvent } from "react";
import { Button, Modal, Panel, Pill, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { fetchConnectionModels, testModel, useAddCustomModels, useConnections, useCustomModels, useDeleteCustomModel, type ModelProbe, type ProviderModel } from "./api";
import { describeProbe, importChoices, importMessage, type ImportChoice, useAs } from "./model-rules";

// docs/contracts/custom-models.md, "Dashboard": every model with the id to call on /v1, custom models added by hand or
// picked from the connection's /models, and a real test request per model.

const limit = (value: number | null, notDeclared: string) => (value === null ? <span className="muted">{notDeclared}</span> : value.toLocaleString());
const capabilityList = (capabilities: Record<string, boolean>) => Object.keys(capabilities).filter((name) => capabilities[name]).join(", ") || "—";

function ImportDialog({ choices, pending, onAdd, onClose }: { choices: ImportChoice[]; pending: boolean; onAdd: (ids: string[]) => void; onClose: () => void }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const query = filter.trim().toLocaleLowerCase();
  const shown = choices.filter((c) => c.id.toLocaleLowerCase().includes(query));
  const fresh = choices.filter((c) => c.state === "new").map((c) => c.id);
  const toggle = (id: string) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return <Modal title={t("providers.importModels")} onClose={onClose}>
    <p>{t("providers.importDetail", { count: choices.length, suffix: choices.length === 1 ? "" : "s", fresh: fresh.length })}</p>
    <input className="input" aria-label={t("providers.filterModels")} placeholder={t("providers.filterPlaceholder")} value={filter} onChange={(e) => setFilter(e.target.value)} />
    <div className="import-list">{shown.map((c) => <label className="import-row" key={c.id}>
      <input type="checkbox" disabled={c.state !== "new"} checked={c.state !== "new" || picked.has(c.id)} onChange={() => toggle(c.id)} />
      <code>{c.id}</code>{c.state === "catalog" && <Pill>{t("providers.inCatalog")}</Pill>}{c.state === "added" && <Pill tone="info">{t("providers.addedPill")}</Pill>}
    </label>)}{shown.length === 0 && <p className="muted">{t("providers.noModelMatch", { query: filter })}</p>}</div>
    <div className="modal-actions"><Button onClick={onClose}>{t("providers.cancel")}</Button>
      <Button disabled={pending || fresh.length === 0} onClick={() => onAdd(fresh)}>{t("providers.addAllNew", { count: fresh.length })}</Button>
      <Button variant="primary" disabled={pending || picked.size === 0} onClick={() => onAdd([...picked])}>{pending ? t("providers.adding") : t("providers.addSelected", { count: picked.size })}</Button></div>
  </Modal>;
}

function ProbeResult({ probe }: { probe: ModelProbe }) {
  const { t } = useLocale();
  const { tone, detail } = describeProbe(probe);
  return <span className="model-probe"><Pill tone={tone}>{probe.ok ? `OK · ${probe.latencyMs} ms` : t("providers.failed")}</Pill>{detail && <small>{detail}</small>}</span>;
}

export function ProviderModels({ providerId, prefix, catalog, thinking = "auto", everyModelReasons = false }: { providerId: string; prefix: string; catalog: readonly ProviderModel[]; thinking?: string; everyModelReasons?: boolean }) {
  const { t } = useLocale();
  const connections = useConnections();
  const custom = useCustomModels(providerId);
  const add = useAddCustomModels(providerId);
  const remove = useDeleteCustomModel(providerId);
  const showToast = useToast();
  const [importing, setImporting] = useState(false);
  const [choices, setChoices] = useState<ImportChoice[] | null>(null);
  const [probes, setProbes] = useState<Record<string, ModelProbe | "testing">>({});
  const connection = connections.data?.find((c) => c.provider === providerId && c.isActive);
  const customModels = custom.data ?? [];
  const listed = new Set([...catalog.map((m) => m.id), ...customModels.map((m) => m.id)]);
  const fail = (error: unknown) => showToast({ tone: "error", ...toProblem(error) });

  const addIds = (ids: string[], done: () => void) => add.mutate(ids, {
     onSuccess: ({ added }) => { done(); showToast({ tone: "success", message: t("providers.addedModels", { count: added, suffix: added === 1 ? "" : "s" }) }); },
    onError: fail,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get("modelId");
    const id = typeof value === "string" ? value.trim() : "";
    if (!id) return;
    if (listed.has(id)) return showToast({ tone: "error", message: t("providers.duplicateModel") });
    addIds([id], () => form.reset());
  };
  const startImport = async () => {
    if (!connection) return;
    setImporting(true);
    try {
      const next = importChoices(await fetchConnectionModels(connection.id), listed);
      const message = importMessage(next);
       if (message) showToast({ tone: "error", message: message === "No models returned from /models." ? t("providers.noFetchedModels") : t("providers.noNewModels") });
      else setChoices(next);
    } catch (error) {
      fail(error);
    } finally {
      setImporting(false);
    }
  };
  const test = async (model: string) => {
    setProbes((current) => ({ ...current, [model]: "testing" }));
    try {
      const probe = await testModel(model);
      setProbes((current) => ({ ...current, [model]: probe }));
    } catch (error) {
      setProbes((current) => {
        const next = { ...current };
        delete next[model];
        return next;
      });
      fail(error);
    }
  };
  const copy = (full: string) => navigator.clipboard.writeText(full).then(
    () => showToast({ tone: "success", message: t("providers.copiedModel", { id: full }) }),
    () => showToast({ tone: "error", message: t("providers.copyFailed") }),
  );
  const callAs = (id: string, chat = true, reasons = everyModelReasons) => {
    const full = useAs(prefix, id, thinking, reasons);
    const probe = probes[full];
    return <div className="model-use"><code>{full}</code><Button variant="ghost" onClick={() => void copy(full)}>Copy</Button>
      <Button variant="ghost" disabled={!connection || !chat || probe === "testing"} onClick={() => void test(full)}>{probe === "testing" ? t("providers.modelTesting") : t("providers.modelTest")}</Button>
      {probe && probe !== "testing" && <ProbeResult probe={probe} />}</div>;
  };

  return <Panel title={t("providers.models")} detail={t("providers.modelsDetail", { catalog: catalog.length, added: customModels.length })} className="section-gap panel-flush">
    <div className="model-toolbar">
      <form className="row" onSubmit={submit}><input className="input" name="modelId" aria-label={t("providers.modelId")} placeholder={t("providers.modelPlaceholder")} /><Button type="submit" disabled={add.isPending}>{t("providers.add")}</Button></form>
      <Button variant="primary" disabled={!connection || importing} onClick={() => void startImport()}>{importing ? t("providers.fetching") : t("providers.importModels")}</Button>
      {!connection && <small className="muted">{t("providers.enableImport")}</small>}
    </div>
    {catalog.length > 0 && <Table empty={t("providers.catalogNoModels")} columns={[t("providers.modelId"), t("providers.useAs"), t("providers.kind"), t("providers.contextWindow"), t("providers.maxOutput"), t("providers.capabilities")]}
      rows={catalog.map((m) => [<strong>{m.name}</strong>, callAs(m.id, m.kind === "chat", m.capabilities.reasoning), m.kind, limit(m.contextWindow, t("providers.notDeclared")), limit(m.maxOutputTokens, t("providers.notDeclared")), capabilityList(m.capabilities)])} />}
    <Table empty={custom.isPending ? t("providers.loading") : custom.isError ? toProblem(custom.error).message : t("providers.noModels")} columns={[t("providers.addedModel"), t("providers.useAs"), t("providers.added"), ""]}
      rows={customModels.map((m) => [<strong>{m.id}</strong>, callAs(m.id), new Date(m.createdAt).toLocaleString(),
        <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(m.id, { onSuccess: () => showToast({ tone: "success", message: t("providers.removedModel", { id: m.id }) }), onError: fail })}>{t("providers.delete")}</Button>])} />
    {choices && <ImportDialog choices={choices} pending={add.isPending} onClose={() => setChoices(null)} onAdd={(ids) => addIds(ids, () => setChoices(null))} />}
  </Panel>;
}
