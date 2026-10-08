'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureGating } from '@/components/commercial/feature-gating';
import { TEST_ONLY_FEATURE_KEY } from '@/lib/commercial/catalog';
import { getTenantFeatureAccess, runTestOnlyCommercialOperation, type TenantFeatureAccess } from '@/repositories/commercial.repository';

export function TestOnlyCommercialProbe() {
  const [access, setAccess] = useState<TenantFeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') { setLoading(false); return; }
    void getTenantFeatureAccess(TEST_ONLY_FEATURE_KEY)
      .then(setAccess)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'A política não autorizou a operação.'))
      .finally(() => setLoading(false));
  }, []);

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') return null;

  async function run() {
    setBusy(true); setError(''); setResult('');
    try {
      const response = await runTestOnlyCommercialOperation();
      setResult(`Operação aceita · uso ${response.used}${response.limit === null ? ' · sem teto explícito' : ` de ${response.limit}`}.`);
      setAccess(await getTenantFeatureAccess(TEST_ONLY_FEATURE_KEY));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Operação TEST_ONLY recusada pelo servidor.');
    } finally { setBusy(false); }
  }

  return <Card className="border-dashed border-violet-300">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="text-violet-700" size={18} />Validação de política TEST_ONLY</CardTitle><CardDescription>Somente Firebase Emulator. Esta operação sintética valida a resposta da interface e do backend; não representa um recurso ou limite comercial.</CardDescription></CardHeader>
    <CardContent className="grid gap-3">
      <FeatureGating access={access} error={error || undefined} loading={loading} title="Operação de prova comercial">
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-emerald-950">Política de teste permitiu a operação neste tenant.</p><Button disabled={busy} onClick={() => void run()}><Play aria-hidden="true" size={15} />{busy ? 'Executando…' : 'Executar operação de prova'}</Button></div>
      </FeatureGating>
      {result ? <p className="text-sm font-medium text-emerald-800" role="status">{result}</p> : null}
      {error && access?.available ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
    </CardContent>
  </Card>;
}
