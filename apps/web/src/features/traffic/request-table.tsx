import { useState } from "react";
import { Pill } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { createFormatters } from "../../shared/i18n";
import type { RequestRow, UsageStatus } from "./api";
import { formatCost, formatTokens } from "./usage-format";
import { TABLE_ROW_HEIGHT, tableWindow } from "./table-window";

const TONE: Record<UsageStatus, "healthy" | "danger" | "warning"> = { success: "healthy", error: "danger", aborted: "warning" };
const WIDTHS = [165, 240, 170, 170, 185, 85, 105, 105, 155, 105];

export function RequestTable({ rows, empty }: { rows: RequestRow[]; empty: string }) {
  const { language, t } = useLocale();
  const f = createFormatters(language);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end } = tableWindow(rows.length, scrollTop);
  const columns = [t("requests.time"), t("requests.model"), t("requests.provider"), t("requests.account"), t("requests.statusLabel"), t("requests.attempts"), "TTFT", t("requests.latency"), t("requests.tokens"), t("requests.cost")];
  const ms = (value: number | null) => value === null ? "—" : `${f.number(value)} ms`;

  return <div className="table-wrap windowed-table-wrap" role="region" aria-label={t("requests.history")} tabIndex={0} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <table className="windowed-table requests-table" aria-rowcount={rows.length + 1}>
      <colgroup>{WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
      <thead><tr aria-rowindex={1}>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="table-empty">{empty}</td></tr> : <>
        {start > 0 && <tr className="windowed-table-spacer" style={{ height: start * TABLE_ROW_HEIGHT }} aria-hidden="true"><td colSpan={columns.length} /></tr>}
        {rows.slice(start, end).map((row, offset) => <tr key={row.id} aria-rowindex={start + offset + 2}>
          <td><a className="table-link mono" href={`/traffic/requests/detail?id=${encodeURIComponent(row.id)}`}>{f.dateTime(row.at)}</a></td>
          <td title={row.requestedModel ?? undefined}><code>{row.requestedModel ?? "—"}</code></td>
          <td title={row.providerName ?? undefined}>{row.providerName ?? "—"}</td>
          <td title={row.connectionName ?? undefined}>{row.connectionName ?? <span className="muted">{t("requests.none")}</span>}</td>
          <td title={row.errorCode ?? undefined}><Pill tone={TONE[row.status]}>{t(`requests.status.${row.status}`)}{row.errorCode ? ` · ${row.errorCode}` : ""}</Pill></td>
          <td>{row.attempts > 1 ? <Pill tone="warning">{f.number(row.attempts)}</Pill> : f.number(row.attempts)}</td>
          <td>{ms(row.ttftMs)}</td><td>{ms(row.latencyMs)}</td>
          <td>{formatTokens(row.inputTokens, locale)} → {formatTokens(row.outputTokens, locale)}</td>
          <td>{row.cost === null ? <span className="muted">{row.unpriced > 0 ? t("requests.unpriced") : "—"}</span> : formatCost(row.cost, locale)}</td>
        </tr>)}
        {end < rows.length && <tr className="windowed-table-spacer" style={{ height: (rows.length - end) * TABLE_ROW_HEIGHT }} aria-hidden="true"><td colSpan={columns.length} /></tr>}
      </>}</tbody>
    </table>
  </div>;
}
