'use client';

import { Dialog } from './dialog';
import { Button } from './button';

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirmar ação', description, confirmLabel = 'Confirmar', confirmDisabled = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; description: string; confirmLabel?: string; confirmDisabled?: boolean }) {
  return <Dialog open={open} onClose={onClose} title={title}><p className="text-sm leading-6 text-slate-600">{description}</p><div className="mt-6 flex justify-end gap-3"><Button disabled={confirmDisabled} onClick={onClose} variant="secondary">Cancelar</Button><Button disabled={confirmDisabled} onClick={onConfirm} variant="danger">{confirmLabel}</Button></div></Dialog>;
}
