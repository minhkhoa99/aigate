import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

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

export function Table({ columns, rows, empty = "No records yet" }: {
  columns: string[]; rows: ReactNode[][]; empty?: string;
}) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) :
      <tr><td colSpan={columns.length} className="table-empty">{empty}</td></tr>}</tbody></table></div>;
}

export function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (item: string) => void }) {
  return <div className="tabs" role="tablist">{items.map((item) => <button key={item} role="tab" aria-selected={active === item}
    className={active === item ? "active" : ""} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Input({ placeholder, type = "text", defaultValue, disabled }: {
  placeholder?: string; type?: string; defaultValue?: string; disabled?: boolean;
}) {
  return <input className="input" type={type} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled} />;
}

export function CopyField({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-wrap">{label && <span className="field-label">{label}</span>}
    <div className="copy-field"><code>{value}</code><button aria-label={`Copy ${label ?? "value"}`} onClick={async () => {
      await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    }}>{copied ? "Copied" : "Copy"}</button></div></div>;
}

export function SecretField({ label }: { label: string }) {
  return <div className="copy-wrap"><span className="field-label">{label}</span><div className="secret-field">
    <Pill tone="healthy">Configured</Pill><Button variant="ghost">Replace</Button></div></div>;
}

export function StateBlock({ state, code, action }: {
  state: "loading" | "empty" | "error"; code?: string; action?: ReactNode;
}) {
  if (state === "loading") return <div className="state-block" aria-label="Loading content"><div className="skeleton wide" /><div className="skeleton" /><div className="skeleton short" /></div>;
  if (state === "empty") return <div className="state-block"><strong>No data to display</strong><p>Connect a provider or change the current filters to see results.</p>{action}</div>;
  return <div className="state-block error"><code>{code ?? "ERR_DATA_UNAVAILABLE"}</code><strong>Could not load this section</strong><p>Check the gateway connection and try again.</p>{action ?? <Button>Retry</Button>}</div>;
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

export function ConfirmDialog({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  return <Modal title="Confirm removal" onClose={onClose}>
    <p>Type <code>{name}</code> to confirm this action.</p>
    <input className="input confirm-input" aria-label={`Type ${name} to confirm`} placeholder={name} value={typed} onChange={(e) => setTyped(e.target.value)} />
    <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button variant="danger" disabled={typed !== name} onClick={onConfirm}>Remove {name}</Button></div>
  </Modal>;
}
