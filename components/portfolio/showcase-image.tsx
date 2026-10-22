'use client';
import { useEffect, useState } from 'react';
import { readShowcaseImage } from '@/repositories/portfolio.repository';
export function ShowcaseImage({ projectId, imageId, caption, tenantSlug }: { projectId: string; imageId: string; caption: string; tenantSlug?: string }) {
  const [source, setSource] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; let current: string | null = null; setSource(''); setFailed(false);
    void readShowcaseImage(projectId, imageId, tenantSlug).then((url) => { current = url; if (active) setSource(url); else URL.revokeObjectURL(url); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (current) URL.revokeObjectURL(current); };
  }, [projectId, imageId, tenantSlug]);
  // Authenticated blob URLs and public responses are both checked by the same tenant-aware endpoint.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img alt={caption || 'Trabalho do ateliê'} className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-cover" loading="lazy" src={source} /> : <div role="status" className="grid aspect-[4/3] place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">{failed ? 'Imagem indisponível' : 'Carregando imagem…'}</div>;
}
