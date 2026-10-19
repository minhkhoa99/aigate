import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input, Warning } from "../../shared/ui";
import { useLocale } from "../../shared/locale";
import { toProblem } from "../../shared/errors";
import { isApiError } from "../../shared/api";
import { useToast } from "../../shared/toast";
import { qoderCancel, qoderConfirm, qoderPoll, qoderStart, type QoderApproval, type QoderAttempt } from "./api";

export function QoderSignIn({ onDone }: { onDone: () => void }) {
  const { t, language } = useLocale();
  const client = useQueryClient(); const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [attempt, setAttempt] = useState<QoderAttempt | null>(null);
  const [approved, setApproved] = useState<QoderApproval | null>(null);
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState<string | null>(null);
  const active = useRef(true); const owned = useRef<string | null>(null);
  const issue = useRef((error: unknown) => setProblem(toProblem(error, language).message));
  issue.current = (error) => setProblem(toProblem(error, language).message);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; if (owned.current) void qoderCancel(owned.current).catch(() => undefined); };
  }, []);

  useEffect(() => {
    if (!attempt || approved) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (Date.now() >= Date.parse(attempt.expiresAt)) { setProblem(t("errors.QODER_ATTEMPT_EXPIRED")); return; }
      try {
        const result = await qoderPoll(attempt.id);
        if (stopped) return;
        if (result.status === "approved") { setApproved(result); return; }
        timer = setTimeout(() => void poll(), attempt.interval * 1000);
      } catch (error) { if (!stopped) issue.current(error); }
    };
    timer = setTimeout(() => void poll(), attempt.interval * 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [attempt, approved, t]);

  const begin = async () => {
    const popup = window.open("about:blank", "aigate-qoder", "popup,width=600,height=720");
    if (!popup) { setProblem(t("providers.allowPopups")); return; }
    popup.opener = null;
    setBusy(true); setProblem(null);
    try {
      const next = await qoderStart(clientId.trim());
      if (!active.current) { popup.close(); await qoderCancel(next.id); return; }
      owned.current = next.id; setAttempt(next); popup.location.assign(next.authUrl);
    } catch (error) { popup.close(); if (active.current) issue.current(error); }
    finally { if (active.current) setBusy(false); }
  };
  const cancel = async () => {
    if (!attempt) return;
    setBusy(true);
    try { await qoderCancel(attempt.id); owned.current = null; setAttempt(null); setApproved(null); setProblem(null); }
    catch (error) {
      if (isApiError(error) && (error.status === 404 || error.status === 410)) { owned.current = null; setAttempt(null); setApproved(null); setProblem(null); }
      else issue.current(error);
    }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!approved) return;
    setBusy(true); setProblem(null);
    try {
      await qoderConfirm(approved.id);
      owned.current = null;
      await client.invalidateQueries({ queryKey: ["connections"], exact: true });
      if (active.current) { toast({ tone: "success", message: t("providers.qoderSaved") }); onDone(); }
    } catch (error) { if (active.current) issue.current(error); }
    finally { if (active.current) setBusy(false); }
  };

  return <div className="stack">
    <Warning tone="warning">{t("providers.qoderValidation")}</Warning>
    <p className="muted">{t("providers.qoderTestHint")}</p>
    {!attempt && <><Field label={t("providers.applicationId")} hint={t("providers.qoderClientHint")}><Input value={clientId} onChange={(event) => setClientId(event.target.value)} maxLength={256} autoComplete="off" /></Field>
      <Button variant="primary" disabled={busy} onClick={() => void begin()}>{busy ? t("providers.opening") : t("providers.signInWithProvider", { provider: "Qoder" })}</Button></>}
    {attempt && <div className="stack" aria-live="polite">
      {approved ? <><p>{t("providers.qoderConfirmHint")}</p><strong>{approved.account.name ?? approved.account.id}</strong>{approved.account.email && <span>{approved.account.email}</span>}<code>{approved.account.id}</code>
        <Button variant="primary" disabled={busy} onClick={() => void confirm()}>{busy ? t("providers.signingIn") : t("providers.qoderConfirm")}</Button></>
        : <><p>{t("providers.qoderWaiting")}</p><a href={attempt.authUrl} target="_blank" rel="noreferrer">{t("providers.qoderOpen")}</a></>}
      <Button disabled={busy} onClick={() => void cancel()}>{t("common.cancel")}</Button>
    </div>}
    {problem && <div role="alert"><Warning tone="danger">{problem}</Warning></div>}
  </div>;
}
