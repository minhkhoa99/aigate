import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocale } from "./locale";
import { Button } from "./ui";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [opener] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  // Radix can release focus after the dialog unmounts; restore it once that teardown finishes.
  useEffect(() => () => { queueMicrotask(() => { if (opener?.isConnected && document.activeElement === document.body) opener.focus(); }); }, [opener]);
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
