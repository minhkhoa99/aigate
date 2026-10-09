import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocale } from "./locale";

export type Tone = "healthy" | "warning" | "danger" | "muted" | "info";

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Dot({ tone = "healthy" }: { tone?: Tone }) {
  return <span aria-hidden="true" className={`dot dot-${tone}`} />;
}

export function Panel({ title, detail, action, children, className = "" }: {
  title: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`panel ${className}`}>
    <div className="panel-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>
    <div className="panel-body">{children}</div>
  </section>;
}

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string; action?: ReactNode;
}) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function Button({ children, variant = "secondary", onClick, disabled = false, type = "button" }: {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void; disabled?: boolean; type?: "button" | "submit";
}) {
  return <button type={type} className={`button button-${variant}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Metric({ label, value, delta, tone = "healthy", bars }: {
  label: string; value: string; delta?: string; tone?: Tone; bars?: number[];
}) {
  return <div className="metric"><div className="metric-label">{label}<span aria-hidden="true">ⓘ</span></div>
    <strong>{value}</strong><div className="metric-foot">{delta && <span className={`text-${tone}`}>{delta}</span>}
      {bars && <div className="spark" aria-hidden="true">{bars.map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div>}
    </div></div>;
}

export function Table({ columns, rows, empty }: {
  columns: string[]; rows: ReactNode[][]; empty?: string;
}) {
  const { t } = useLocale();
  return <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) :
      <tr><td colSpan={columns.length} className="table-empty">{empty ?? t("common.noRecords")}</td></tr>}</tbody></table></div>;
}

export function Tabs({ items, active, onChange, getLabel }: { items: string[]; active: string; onChange: (item: string) => void; getLabel?: (item: string) => string }) {
  return <div className="tabs" role="tablist">{items.map((item) => <button key={item} role="tab" aria-selected={active === item}
    className={active === item ? "active" : ""} onClick={() => onChange(item)}>{getLabel?.(item) ?? item}</button>)}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Input({ placeholder, type = "text", defaultValue, disabled, name, required, minLength, maxLength, autoComplete }: {
  placeholder?: string; type?: string; defaultValue?: string; disabled?: boolean;
  name?: string; required?: boolean; minLength?: number; maxLength?: number; autoComplete?: string;
}) {
  return <input className="input" type={type} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled}
    name={name} required={required} minLength={minLength} maxLength={maxLength} autoComplete={autoComplete} />;
}

export function CopyField({ label, value }: { label?: string; value: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  return <div className="copy-wrap">{label && <span className="field-label">{label}</span>}
    <div className="copy-field"><code>{value}</code><button aria-label={t("common.copyLabel", { label: label ?? t("common.value") })} onClick={async () => {
      await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    }}>{t(copied ? "common.copied" : "common.copy")}</button></div></div>;
}

export function SecretField({ label }: { label: string }) {
  const { t } = useLocale();
  return <div className="copy-wrap"><span className="field-label">{label}</span><div className="secret-field">
    <Pill tone="healthy">{t("common.configured")}</Pill><Button variant="ghost">{t("common.replace")}</Button></div></div>;
}

export function StateBlock({ state, code, action }: {
  state: "loading" | "empty" | "error"; code?: string; action?: ReactNode;
}) {
  const { t } = useLocale();
  if (state === "loading") return <div className="state-block" aria-label={t("common.loading")}><div className="skeleton wide" /><div className="skeleton" /><div className="skeleton short" /></div>;
  if (state === "empty") return <div className="state-block"><strong>{t("common.empty")}</strong><p>{t("common.emptyHint")}</p>{action}</div>;
  return <div className="state-block error"><code>{code ?? "ERR_DATA_UNAVAILABLE"}</code><strong>{t("common.loadFailed")}</strong><p>{t("common.loadHint")}</p>{action ?? <Button>{t("common.retry")}</Button>}</div>;
}

export function Warning({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "danger" }) {
  return <div className={`warning warning-${tone}`}>{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="modal-backdrop" />
    <Dialog.Content className="modal" aria-describedby={undefined}>
      <Dialog.Title>{title}</Dialog.Title>{children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

export function ConfirmDialog({ name, detail, pending = false, onClose, onConfirm }: { name: string; detail?: ReactNode; pending?: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useLocale();
  const [typed, setTyped] = useState("");
  return <Modal title={t("common.confirmRemoval")} onClose={onClose}>
    {detail && <p>{detail}</p>}<p>{t("common.confirmInstruction", { name })}</p>
    <input className="input confirm-input" aria-label={t("common.confirmAria", { name })} placeholder={name} value={typed} onChange={(e) => setTyped(e.target.value)} />
    <div className="modal-actions"><Button onClick={onClose} disabled={pending}>{t("common.cancel")}</Button><Button variant="danger" disabled={typed !== name || pending} onClick={onConfirm}>{t("common.remove", { name })}</Button></div>
  </Modal>;
}
