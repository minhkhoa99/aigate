import { useEffect, useRef, useState } from "react";
import { Button, PageHeading, Panel, Pill, StateBlock, Warning } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import { useConsoleLogs, type ConsoleEvent } from "./api";
import { ConsoleLines } from "./console-lines";

export { Usage } from "./usage";
export { RequestDetail, Requests } from "./requests";

function matches(row: ConsoleEvent, level: string, filter: string): boolean {
  return (level === "all" || (level === "warn" ? row.level === "WARN" : row.level === "ERROR")) && row.message.toLowerCase().includes(filter);
}

export function Console() {
  const { language, t } = useLocale();
  const [level, setLevel] = useState("all");
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const clearing = useRef(false);
  const lastEventId = useRef<string | null | undefined>(undefined);
  const { query, connected, stopped, clear } = useConsoleLogs(!paused);
  const toast = useToast();
  const normalizedFilter = filter.toLowerCase();
  const rows = (query.data ?? []).filter((row) => matches(row, level, normalizedFilter));
  const latest = query.data?.at(-1);
  useEffect(() => {
    if (!query.data) return;
    const previous = lastEventId.current;
    lastEventId.current = latest?.id ?? null;
    if (previous === undefined) return;
    if (!latest) { setAnnouncement(""); return; }
    if (previous !== latest.id && !paused && matches(latest, level, normalizedFilter)) setAnnouncement(latest.message);
  }, [latest?.id, level, normalizedFilter, paused]);
  const readProblem = query.isError ? toProblem(query.error, language) : null;
  async function clearLog() {
    if (clearing.current) return;
    clearing.current = true;
    setClearPending(true);
    try { await clear(); }
    catch (error) { toast({ tone: "error", error }); }
    finally { clearing.current = false; setClearPending(false); }
  }
  return <><PageHeading eyebrow={t("console.eyebrow")} title={t("console.title")} description={t("console.description")} action={<div className="row"><Pill tone={connected ? "healthy" : "muted"}>{paused ? t("console.paused") : stopped ? t("console.stopped") : connected ? t("console.live") : t("console.connecting")}</Pill><Button onClick={() => setPaused(!paused)}>{paused ? t("console.resume") : t("console.pause")}</Button><Button onClick={() => void clearLog()} disabled={clearPending}>{t("console.clear")}</Button></div>} />
    <Warning>{t("console.privacy")}</Warning>
    <Panel title={t("console.events")} className="section-gap panel-flush"><div className="table-toolbar"><select className="input" value={level} onChange={(e) => { setLevel(e.target.value); setAnnouncement(""); }} aria-label={t("console.levelFilter")}><option value="all">{t("console.allLevels")}</option><option value="warn">{t("console.warnings")}</option><option value="error">{t("console.errors")}</option></select><input className="input" aria-label={t("console.messageFilter")} placeholder={t("console.messageFilter")} value={filter} maxLength={200} onChange={(event) => { setFilter(event.target.value); setAnnouncement(""); }} /></div>
      {query.isPending ? <StateBlock state="loading" /> : readProblem ? <div className="state-block error"><code>{readProblem.code}</code><strong>{t("console.loadFailed")}</strong><p>{readProblem.message}</p><Button onClick={() => void query.refetch()}>{t("common.retry")}</Button></div>
        : <><ConsoleLines key={JSON.stringify([level, filter, rows.length === 0])} rows={rows} empty={filter || level !== "all" ? t("console.emptyFiltered") : t("console.empty")} /><span className="sr-only" role="status">{announcement}</span></>}
    </Panel></>;
}
