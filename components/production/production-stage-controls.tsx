'use client';

import { useState } from 'react';
import { Camera, Check, CirclePlay, LockKeyhole, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/providers/tenant-provider';
import { updateProductionStage, uploadProductionPhoto } from '@/repositories/orders.repository';
import type { OrderRecord } from '@/types/order';
import type { ProductionStage } from '@/types/production';

const labels = { pending: 'A iniciar', in_progress: 'Em andamento', waiting_approval: 'Aguardando aprovação', approved: 'Aprovada', completed: 'Concluída', blocked: 'Bloqueada' };

export function ProductionStageControls({ record, reload }: { record: OrderRecord; reload: () => Promise<void> }) {
  const { hasPermission } = useTenant();
  const toast = useToast();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const canManage = hasPermission('orders:manage');
  const stages = [...record.productionStages].sort((a, b) => a.order - b.order);
  const orderLive = ['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused'].includes(record.order.status);

  async function run(stage: ProductionStage, action: 'start' | 'progress' | 'complete' | 'block') {
    const note = notes[stage.id] ?? '';
    if (action === 'block' && note.trim().length < 4) { toast('Explique o motivo do bloqueio.', 'error'); return; }
    setBusy(stage.id);
    try {
      await updateProductionStage({
        atelierId: record.order.atelierId, orderId: record.order.id, stageId: stage.id, action,
        ...(action === 'progress' ? { progress: progress[stage.id] ?? Math.max(1, stage.progress) } : {}),
        note,
      });
      toast(action === 'complete' && stage.requiresClientApproval ? 'Etapa enviada para aprovação do cliente.' : 'Etapa atualizada.', 'success');
      await reload();
    } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível atualizar a etapa.', 'error'); }
    finally { setBusy(''); }
  }

  async function sendPhoto(stage: ProductionStage) {
    const file = files[stage.id];
    if (!file) { toast('Selecione uma foto de progresso.', 'error'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast('A foto precisa ser JPEG, PNG ou WebP, com até 10 MB.', 'error'); return;
    }
    setBusy(`photo-${stage.id}`);
    try {
      await uploadProductionPhoto({
        atelierId: record.order.atelierId, orderId: record.order.id, stageId: stage.id,
        file, caption: captions[stage.id] ?? '', visibleToClient: visible[stage.id] !== false,
      });
      toast('Foto de progresso enviada.', 'success');
      setFiles((current) => ({ ...current, [stage.id]: null }));
      const input = document.getElementById(`production-photo-${stage.id}`) as HTMLInputElement | null;
      if (input) input.value = '';
      await reload();
    } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível enviar a foto.', 'error'); }
    finally { setBusy(''); }
  }

  if (!canManage) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Sua conta pode acompanhar o pedido, mas não tem permissão para alterar a produção.</div>;
  if (!stages.length) return <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/70 p-5 text-sm leading-6 text-slate-700">{record.order.status === 'waiting_deposit' ? 'Confirme a entrada recebida no resumo do pedido para liberar o planejamento e a produção.' : 'As etapas ainda não foram inicializadas.'}</div>;

  const nextStageIndex = stages.findIndex((stage) => !['completed', 'approved'].includes(stage.status));
  return <div className="grid gap-4">
    {!orderLive ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Este pedido não está em uma etapa ativa de produção.</div> : null}
    {stages.map((stage, index) => {
      const isCurrent = index === nextStageIndex;
      const active = stage.status === 'in_progress';
      const waiting = stage.status === 'waiting_approval';
      const stageBusy = busy === stage.id;
      return <Card className={isCurrent ? 'border-violet-300 ring-1 ring-violet-100' : ''} key={stage.id}>
        <CardHeader className="flex flex-row items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Etapa {index + 1} · peso {stage.progressWeight}%</p><CardTitle className="mt-1">{stage.name}</CardTitle><p className="text-sm text-slate-600">{stage.requiresClientApproval ? 'Aprovação do cliente obrigatória' : 'Aprovação do cliente não exigida'}</p></div><Badge tone={stage.status === 'completed' ? 'green' : stage.status === 'blocked' ? 'red' : waiting ? 'amber' : active ? 'violet' : 'neutral'}>{labels[stage.status]}</Badge></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Progresso desta etapa</span><strong>{stage.progress}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${stage.progress}%` }} /></div>
          {stage.notes ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Última observação: {stage.notes}</p> : null}
          {waiting ? <p className="mt-4 text-sm leading-6 text-amber-800">A equipe aguarda a resposta do cliente. O avanço das próximas etapas fica bloqueado até a decisão.</p> : null}
          {isCurrent && orderLive && !waiting ? <div className="mt-4 grid gap-3">
            {active ? <>
              <label className="text-sm font-medium text-slate-700" htmlFor={`stage-progress-${stage.id}`}>Progresso: {progress[stage.id] ?? stage.progress}%</label>
              <input className="w-full accent-violet-700" id={`stage-progress-${stage.id}`} max={99} min={1} onChange={(event) => setProgress((current) => ({ ...current, [stage.id]: Number(event.target.value) }))} type="range" value={progress[stage.id] ?? Math.max(1, Math.min(99, stage.progress || 1))} />
              <Textarea className="min-h-20" maxLength={600} onChange={(event) => setNotes((current) => ({ ...current, [stage.id]: event.target.value }))} placeholder="Observação de andamento, material ou ajuste (opcional)." value={notes[stage.id] ?? ''} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={stageBusy} onClick={() => void run(stage, 'progress')} variant="secondary"><RefreshCw size={16} />Salvar progresso</Button>
                <Button disabled={stageBusy} onClick={() => void run(stage, 'complete')}><Check size={16} />{stage.requiresClientApproval ? 'Solicitar aprovação do cliente' : 'Concluir etapa'}</Button>
                <Button disabled={stageBusy} onClick={() => void run(stage, 'block')} variant="danger"><LockKeyhole size={15} />Bloquear</Button>
              </div>
            </> : <Button disabled={stageBusy} onClick={() => void run(stage, 'start')}><CirclePlay size={16} />{stage.status === 'blocked' ? 'Retomar etapa' : 'Iniciar etapa'}</Button>}
            {(active || stage.status === 'blocked') ? <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2"><Camera className="text-violet-700" size={17} /><h3 className="text-sm font-semibold">Foto de progresso</h3></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor={`production-photo-${stage.id}`}>Imagem (até 10 MB)</label><Input accept="image/jpeg,image/png,image/webp" id={`production-photo-${stage.id}`} onChange={(event) => setFiles((current) => ({ ...current, [stage.id]: event.target.files?.[0] ?? null }))} type="file" /></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor={`photo-caption-${stage.id}`}>Descrição para o histórico</label><Input id={`photo-caption-${stage.id}`} maxLength={500} onChange={(event) => setCaptions((current) => ({ ...current, [stage.id]: event.target.value }))} placeholder="Ex.: prova do acabamento da manga" value={captions[stage.id] ?? ''} /></div></div>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input checked={visible[stage.id] !== false} className="mt-1 accent-violet-700" onChange={(event) => setVisible((current) => ({ ...current, [stage.id]: event.target.checked }))} type="checkbox" />Visível ao cliente</label>
              <Button className="mt-3" disabled={busy === `photo-${stage.id}`} onClick={() => void sendPhoto(stage)} variant="secondary"><Camera size={16} />Enviar foto</Button>
            </div> : null}
          </div> : null}
        </CardContent>
      </Card>;
    })}
  </div>;
}
