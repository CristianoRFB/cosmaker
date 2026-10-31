'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Dialog({ id, open, onClose, title, children }: { id?: string; open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog aria-labelledby={titleId} className="m-auto max-h-[85dvh] w-[min(92vw,36rem)] overflow-y-auto rounded-2xl border border-violet-100 p-0 shadow-2xl backdrop:bg-slate-950/40" id={id} onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); } }} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} ref={ref}>
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3"><h2 className="font-semibold" id={titleId}>{title}</h2><button aria-label="Fechar" className="grid size-11 shrink-0 place-items-center rounded-lg text-xl text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">×</button></div><div className="p-5">{children}</div>
  </dialog>;
}
