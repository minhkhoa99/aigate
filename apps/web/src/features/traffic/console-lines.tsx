import { useMemo, useState } from "react";
import { useLocale } from "../../shared/locale";
import { createFormatters } from "../../shared/i18n";
import type { ConsoleEvent } from "./api";
import { CONSOLE_ROW_HEIGHT, consoleWindow } from "./console-window";

export function ConsoleLines({ rows, empty }: { rows: ConsoleEvent[]; empty: string }) {
  const { language, t } = useLocale();
  const format = useMemo(() => createFormatters(language), [language]);
  const width = useMemo(() => rows.reduce((max, row) => Math.max(max, row.message.length + 30), 0), [rows]);
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end } = consoleWindow(rows.length, scrollTop);

  return <div className="console-lines" role="log" aria-live="off" aria-label={t("console.events")} tabIndex={0} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div className="console-lines-content" style={rows.length ? { minWidth: `${width}ch` } : undefined}>
      {start > 0 && <div className="console-spacer" style={{ height: start * CONSOLE_ROW_HEIGHT }} aria-hidden="true" />}
      {rows.slice(start, end).map((row) => <div key={row.id} title={row.message}><time dateTime={row.at}>{format.time(Date.parse(row.at))}</time> <strong>{row.level}</strong> {row.message}</div>)}
      {end < rows.length && <div className="console-spacer" style={{ height: (rows.length - end) * CONSOLE_ROW_HEIGHT }} aria-hidden="true" />}
      {rows.length === 0 && <p className="muted">{empty}</p>}
    </div>
  </div>;
}
