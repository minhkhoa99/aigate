import { Button, Metric, PageHeading, Panel, StateBlock, Warning } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { createFormatters } from "../../shared/i18n";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useQuotas, useRefreshQuotas, type ConnectionQuota, type QuotaLine } from "./api";

type WindowLine = QuotaLine & { account: ConnectionQuota };
const usedPercent = (line: QuotaLine) => line.unlimited || line.total === 0 ? 0 : Math.round(line.used / line.total * 100);

// docs/contracts/quota-ui-i18n.md: display over the existing bounded SP24c API.
export function Quota() {
  const { language, t } = useLocale();
  const format = createFormatters(language);
  const quotas = useQuotas();
  const refresh = useRefreshQuotas();
  const showToast = useToast();
  const problem = quotas.isError ? toProblem(quotas.error, language) : null;
  const lines: WindowLine[] = (quotas.data ?? []).flatMap((account) => account.quotas.map((line) => ({ ...line, account })));
  const windows = lines.filter((line) => !line.name.includes("(USD)"));
  const healthy = windows.filter((line) => line.unlimited || usedPercent(line) < 75).length;
  const near = windows.filter((line) => !line.unlimited && usedPercent(line) >= 75 && usedPercent(line) < 100).length;
  const exhausted = windows.filter((line) => !line.unlimited && usedPercent(line) >= 100).length;
  const ready = quotas.isSuccess;
  const metric = (value: number) => ready ? format.number(value) : "—";
  const reset = (value: string | null) => {
    const at = value ? Date.parse(value) : NaN;
    return Number.isFinite(at) ? format.dateTime(at) : t("quota.notReported");
  };

  return <>
    <PageHeading eyebrow={t("quota.eyebrow")} title={t("quota.title")} description={t("quota.description")}
      action={<Button variant="primary" disabled={refresh.isPending} onClick={() => refresh.mutate(undefined, {
        onError: (error) => showToast({ tone: "error", error }),
      })}>{t(refresh.isPending ? "quota.refreshing" : "quota.refresh")}</Button>} />
    <div className="grid grid-3">
      <Metric label={t("quota.healthy")} value={metric(healthy)} delta={ready ? t("quota.reportedWindows", { count: format.number(windows.length) }) : t("quota.unknown")} />
      <Metric label={t("quota.near")} value={metric(near)} delta={ready ? t("quota.nearHint") : t("quota.unknown")} tone="warning" />
      <Metric label={t("quota.exhausted")} value={metric(exhausted)} delta={ready ? t("quota.exhaustedHint") : t("quota.unknown")} tone="danger" />
    </div>
    <Panel title={t("quota.limits")} detail={t("quota.limitsHint")} className="section-gap">
      {quotas.isPending ? <StateBlock state="loading" />
        : problem ? <><StateBlock state="error" code={problem.code} action={<Button onClick={() => void quotas.refetch()}>{t("common.retry")}</Button>} />
          <Warning tone="danger">{problem.message}</Warning></>
        : <div className="stack">{lines.map((line) => {
          const amount = line.name.includes("(USD)");
          const used = Math.min(100, usedPercent(line));
          const value = amount ? line.remaining === null ? t("quota.notReported") : t("quota.available", { amount: format.usd(line.remaining) })
            : line.unlimited ? t("quota.unlimited") : t("quota.used", { percent: format.number(used) });
          return <div className="quota-row" key={`${line.account.connectionId}:${line.name}`}>
            <div className="row between"><strong>{line.account.name} <span className="muted">· {line.name}</span></strong><span className="muted mono">{value}</span></div>
            <small>{line.account.plan ?? line.account.provider} · {t("quota.resets", { time: reset(line.resetAt) })}{line.account.cached ? ` · ${t("quota.cached")}` : ""}</small>
            {!line.unlimited && !amount && <div className={`progress ${used >= 100 ? "danger" : used >= 75 ? "warning" : ""}`}><span style={{ width: `${used}%` }} /></div>}
          </div>;
        })}{(quotas.data ?? []).filter((account) => account.quotas.length === 0).map((account) =>
          <div className="quota-row" key={account.connectionId}><strong>{account.name}</strong><small>{account.message ?? t("quota.noWindows")}</small></div>)}
        {(quotas.data ?? []).length === 0 && <StateBlock state="empty" />}</div>}
    </Panel>
  </>;
}
