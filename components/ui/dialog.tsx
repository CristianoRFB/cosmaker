'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Dialog({ open, onClose, title, children, id }: { id?: string; open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog id={id} aria-labelledby={titleId} className="m-auto w-[min(92vw,36rem)] max-h-[85dvh] overflow-y-auto rounded-2xl border border-violet-100 p-0 shadow-2xl backdrop:bg-slate-950/40" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} ref={ref}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold" id={titleId}>{title}</h2><button aria-label="Fechar" className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">×</button></div><div className="p-5">{children}</div></dialog>;
}
