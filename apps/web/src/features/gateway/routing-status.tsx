import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createFormatters } from "../../shared/i18n";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { Button, Panel, Pill, StateBlock, Table, Warning } from "../../shared/ui";
import { useRoutingStatus } from "./api";

function remaining(until: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(until) - now) / 1000));
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RoutingStatusTab({ mode, onSimulate }: { mode: "overview" | "fallback"; onSimulate: () => void }) {
  const { t, language } = useLocale();
  const format = useMemo(() => createFormatters(language), [language]);
  const query = useRoutingStatus();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (mode !== "fallback") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode]);
  if (query.isPending) return <div className="section-gap"><StateBlock state="loading" /></div>;
  if (query.isError) {
    const problem = toProblem(query.error, language);
    return <div className="section-gap"><StateBlock state="error" code={problem.code} action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>} /><Warning tone="danger">{problem.message}</Warning></div>;
  }
  const status = query.data;
  const refresh = <Button onClick={() => void query.refetch()} disabled={query.isFetching}>{t("common.refresh")}</Button>;
  const observed = t("routingStatus.observed", { time: format.dateTime(Date.parse(status.observedAt)) });
  if (mode === "overview") return <div className="stack section-gap routing-status">
    <Panel title={t("routingStatus.routesTitle")} detail={observed} action={refresh}>
      <p className="muted">{t("routingStatus.routesHint")}</p>
      <div className="row wrap"><Pill tone="info">{t("routingStatus.comboCount", { count: format.number(status.comboCount) })}</Pill><Pill tone="info">{t("routingStatus.poolCount", { count: format.number(status.enabledPoolCount) })}</Pill></div>
      {status.routes.length === 0 ? <p>{t("routingStatus.emptyRoutes")}</p> : status.routes.map(route =>
        <div className="list-row" key={route.provider}><div><strong><code>{route.provider}</code></strong><small>{route.kind === "keyless" ? t("routingStatus.keyless") : t("routingStatus.accountCount", { count: format.number(route.activeAccounts) })}</small></div><Pill tone="muted">{route.kind === "keyless" ? t("routingStatus.keylessLabel") : t("routingStatus.accountLabel")}</Pill></div>)}
      {status.routesTruncated && <Warning>{t("routingStatus.routesTruncated")}</Warning>}
    </Panel>
    <Panel title={t("routingStatus.simulateTitle")} detail={t("routingStatus.simulateHint")}><Button onClick={onSimulate}>{t("routingStatus.openSimulator")}</Button></Panel>
  </div>;
  return <div className="stack section-gap routing-status">
    <Panel title={t("routingStatus.policyTitle")} detail={observed} action={refresh}>
      <div className="list-row"><div><strong>{t("routingStatus.strategy")}</strong><small>{t(status.fallbackStrategy === "fill-first" ? "routingStatus.fillFirstHint" : "routingStatus.roundRobinHint")}</small></div><Pill tone="info">{t(status.fallbackStrategy === "fill-first" ? "routingStatus.fillFirst" : "routingStatus.roundRobin")}</Pill></div>
      <div className="list-row"><div><strong>{t("routingStatus.stickyLimit")}</strong><small>{t("routingStatus.stickyHint")}</small></div><Pill>{format.number(status.comboStickyLimit)}</Pill></div>
      <Link to="/settings/auth" className="button button-secondary">{t("routingStatus.openSettings")}</Link>
    </Panel>
    <Panel title={t("routingStatus.locksTitle")} detail={t("routingStatus.locksHint")}>
      <Table columns={[t("routingStatus.account"), t("routingStatus.model"), t("routingStatus.expires"), t("routingStatus.remaining")]} empty={t("routingStatus.emptyLocks")}
        rows={status.locks.map(lock => [
          <span><strong>{lock.name}</strong><small className="routing-status-small"><code>{lock.provider}</code>{!lock.isActive && ` · ${t("routingStatus.disabled")}`}</small></span>,
          <code>{lock.model}</code>, format.dateTime(Date.parse(lock.until)),
          Date.parse(lock.until) < now ? t("routingStatus.expired") : remaining(lock.until, now),
        ])} />
      {status.locksTruncated && <Warning>{t("routingStatus.locksTruncated")}</Warning>}
    </Panel>
  </div>;
}
