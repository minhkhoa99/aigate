import { useState, type FormEvent } from "react";
import { Button, Modal, Panel, Pill, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { fetchConnectionModels, testModel, useAddCustomModels, useConnections, useCustomModels, useDeleteCustomModel, type ModelProbe, type ProviderModel } from "./api";
import { describeProbe, DUPLICATE, importChoices, importMessage, type ImportChoice } from "./model-rules";

// docs/contracts/custom-models.md, "Dashboard": every model with the id to call on /v1, custom models added by hand or
// picked from the connection's /models, and a real test request per model.

const limit = (value: number | null) => (value === null ? <span className="muted">not declared</span> : value.toLocaleString());
const capabilityList = (capabilities: Record<string, boolean>) => Object.keys(capabilities).filter((name) => capabilities[name]).join(", ") || "—";

function ImportDialog({ choices, pending, onAdd, onClose }: { choices: ImportChoice[]; pending: boolean; onAdd: (ids: string[]) => void; onClose: () => void }) {
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
  return <Modal title="Import from /models" onClose={onClose}>
    <p>The provider lists {choices.length} model{choices.length === 1 ? "" : "s"}; {fresh.length} not added yet. Pick the ones to call through AIGate.</p>
    <input className="input" aria-label="Filter models" placeholder="Filter models…" value={filter} onChange={(e) => setFilter(e.target.value)} />
    <div className="import-list">{shown.map((c) => <label className="import-row" key={c.id}>
      <input type="checkbox" disabled={c.state !== "new"} checked={c.state !== "new" || picked.has(c.id)} onChange={() => toggle(c.id)} />
      <code>{c.id}</code>{c.state === "catalog" && <Pill>In catalog</Pill>}{c.state === "added" && <Pill tone="info">Added</Pill>}
    </label>)}{shown.length === 0 && <p className="muted">No model matches “{filter}”.</p>}</div>
    <div className="modal-actions"><Button onClick={onClose}>Cancel</Button>
      <Button disabled={pending || fresh.length === 0} onClick={() => onAdd(fresh)}>Add all new ({fresh.length})</Button>
      <Button variant="primary" disabled={pending || picked.size === 0} onClick={() => onAdd([...picked])}>{pending ? "Adding…" : `Add selected (${picked.size})`}</Button></div>
  </Modal>;
}

function ProbeResult({ probe }: { probe: ModelProbe }) {
  const { tone, label, detail } = describeProbe(probe);
  return <span className="model-probe"><Pill tone={tone}>{label}</Pill>{detail && <small>{detail}</small>}</span>;
}

export function ProviderModels({ providerId, prefix, catalog }: { providerId: string; prefix: string; catalog: readonly ProviderModel[] }) {
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
    onSuccess: ({ added }) => { done(); showToast({ tone: "success", message: `Added ${added} model${added === 1 ? "" : "s"}.` }); },
    onError: fail,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get("modelId");
    const id = typeof value === "string" ? value.trim() : "";
    if (!id) return;
    if (listed.has(id)) return showToast({ tone: "error", message: DUPLICATE });
    addIds([id], () => form.reset());
  };
  const startImport = async () => {
    if (!connection) return;
    setImporting(true);
    try {
      const next = importChoices(await fetchConnectionModels(connection.id), listed);
      const message = importMessage(next);
      if (message) showToast({ tone: "error", message });
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
    () => showToast({ tone: "success", message: `Copied ${full}.` }),
    () => showToast({ tone: "error", message: "The browser did not allow copying. Select the id and copy it by hand." }),
  );
  const callAs = (id: string, chat = true) => {
    const full = `${prefix}/${id}`;
    const probe = probes[full];
    return <div className="model-use"><code>{full}</code><Button variant="ghost" onClick={() => void copy(full)}>Copy</Button>
      <Button variant="ghost" disabled={!connection || !chat || probe === "testing"} onClick={() => void test(full)}>{probe === "testing" ? "Testing…" : "Test"}</Button>
      {probe && probe !== "testing" && <ProbeResult probe={probe} />}</div>;
  };

  return <Panel title="Models" detail={`Call a model on /v1 by the id in "Use as". ${catalog.length} in the catalog, ${customModels.length} added. The provider may serve more: import them from its /models or add an id by hand.`} className="section-gap panel-flush">
    <div className="model-toolbar">
      <form className="row" onSubmit={submit}><input className="input" name="modelId" aria-label="Model ID" placeholder="Model ID, e.g. gpt-4o" /><Button type="submit" disabled={add.isPending}>Add</Button></form>
      <Button variant="primary" disabled={!connection || importing} onClick={() => void startImport()}>{importing ? "Fetching…" : "Import from /models"}</Button>
      {!connection && <small className="muted">Add a connection to enable importing models.</small>}
    </div>
    {catalog.length > 0 && <Table empty="The catalog lists no models for this provider." columns={["Model", "Use as", "Kind", "Context window", "Max output", "Capabilities"]}
      rows={catalog.map((m) => [<strong>{m.name}</strong>, callAs(m.id, m.kind === "chat"), m.kind, limit(m.contextWindow), limit(m.maxOutputTokens), capabilityList(m.capabilities)])} />}
    <Table empty={custom.isPending ? "Loading…" : custom.isError ? toProblem(custom.error).message : "No models added yet."} columns={["Added model", "Use as", "Added", ""]}
      rows={customModels.map((m) => [<strong>{m.id}</strong>, callAs(m.id), new Date(m.createdAt).toLocaleString(),
        <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(m.id, { onSuccess: () => showToast({ tone: "success", message: `Removed ${m.id}.` }), onError: fail })}>Delete</Button>])} />
    {choices && <ImportDialog choices={choices} pending={add.isPending} onClose={() => setChoices(null)} onAdd={(ids) => addIds(ids, () => setChoices(null))} />}
  </Panel>;
}
