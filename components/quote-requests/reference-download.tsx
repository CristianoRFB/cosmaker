'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadQuoteRequestReference } from '@/repositories/quotes.repository';
import type { QuoteRequestReference } from '@/types/quote-request';
export function QuoteReferenceDownload({ requestId, reference }: { requestId: string; reference: QuoteRequestReference }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function download() { setBusy(true); setError(''); try { await downloadQuoteRequestReference(requestId, reference); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível baixar a referência.'); } finally { setBusy(false); } }
  return <div className="mt-2 grid gap-2"><Button variant="secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Carregando referência…' : 'Baixar referência'}</Button>{error && <p role="alert" className="text-xs text-rose-800">{error}</p>}</div>;
}
