'use client';

import { Dialog } from './dialog';
import { Button } from './button';

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirmar ação', description, confirmLabel = 'Confirmar' }: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; description: string; confirmLabel?: string }) {
  return <Dialog open={open} onClose={onClose} title={title}><p className="text-sm leading-6 text-slate-600">{description}</p><div className="mt-6 flex justify-end gap-3"><Button onClick={onClose} variant="secondary">Cancelar</Button><Button onClick={onConfirm} variant="danger">{confirmLabel}</Button></div></Dialog>;
}
