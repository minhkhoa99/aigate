import { useState } from "react";
import { useLocale } from "../../shared/locale";
import type { UsageSummary } from "./api";
import { errorRate, formatCost, formatTokens } from "./usage-format";
import { TABLE_ROW_HEIGHT, tableWindow } from "./table-window";

const WIDTHS = [160, 230, 90, 100, 100, 110, 110, 100];

export function UsageModelTable({ rows }: { rows: UsageSummary["byModel"] }) {
  const { language, t } = useLocale();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const number = new Intl.NumberFormat(locale).format;
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end } = tableWindow(rows.length, scrollTop);
  const columns = [t("usage.provider"), t("usage.model"), t("usage.requests"), t("usage.input"), t("usage.output"), t("usage.cacheRead"), t("usage.cost"), t("usage.errorPercent")];

  return <div className="table-wrap windowed-table-wrap" role="region" aria-label={t("usage.providerModel")} tabIndex={0} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <table className="windowed-table usage-model-table" aria-rowcount={rows.length + 1}>
      <colgroup>{WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
      <thead><tr aria-rowindex={1}>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="table-empty">{t("common.noRecords")}</td></tr> : <>
        {start > 0 && <tr className="windowed-table-spacer" style={{ height: start * TABLE_ROW_HEIGHT }} aria-hidden="true"><td colSpan={columns.length} /></tr>}
        {rows.slice(start, end).map((row, offset) => <tr key={`${row.provider}/${row.model}`} aria-rowindex={start + offset + 2}>
          <td title={row.providerName}>{row.providerName}</td><td title={row.model}><code>{row.model}</code></td>
          <td>{number(row.requests)}</td><td>{formatTokens(row.inputTokens, locale)}</td><td>{formatTokens(row.outputTokens, locale)}</td>
          <td>{formatTokens(row.cacheReadTokens, locale)}</td>
          <td>{row.unpriced === row.requests ? <span className="muted">{t("usage.unpriced")}</span> : formatCost(row.cost, locale)}</td>
          <td>{errorRate(row.errors, row.requests, locale)}</td>
        </tr>)}
        {end < rows.length && <tr className="windowed-table-spacer" style={{ height: (rows.length - end) * TABLE_ROW_HEIGHT }} aria-hidden="true"><td colSpan={columns.length} /></tr>}
      </>}</tbody>
    </table>
  </div>;
}
