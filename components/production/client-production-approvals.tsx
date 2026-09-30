'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { respondToProductionApproval } from '@/repositories/orders.repository';
import type { OrderRecord } from '@/types/order';

export function ClientProductionApprovals({ record, reload }: { record: OrderRecord; reload: () => Promise<void> }) {
  const toast = useToast();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const pending = record.approvals.filter((approval) => approval.status === 'pending');
  if (!pending.length) return null;

  async function respond(approvalId: string, decision: 'approved' | 'changes_requested') {
    const comment = comments[approvalId] ?? '';
    if (decision === 'changes_requested' && comment.trim().length < 5) {
      toast('Descreva o ajuste desejado para a equipe.', 'error');
      return;
    }
    setBusyId(approvalId);
    try {
      await respondToProductionApproval({ atelierId: record.order.atelierId, orderId: record.order.id, approvalId, decision, comment });
      toast(decision === 'approved' ? 'Etapa aprovada. A equipe já pode continuar.' : 'Ajuste solicitado e registrado no histórico.', 'success');
      await reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível registrar sua resposta.', 'error');
    } finally { setBusyId(''); }
  }

  return <Card className="border-fuchsia-200">
    <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="text-fuchsia-700" size={19} />Sua aprovação é necessária</CardTitle><p className="text-sm text-slate-600">Revise as fotos e aprove ou descreva o ajuste solicitado. Sua resposta ficará registrada no pedido.</p></CardHeader>
    <CardContent className="grid gap-4">
      {pending.map((approval) => {
        const photos = record.productionPhotos.filter((photo) => photo.stageId === approval.stageId && photo.visibleToClient && photo.uploadStatus === 'ready');
        return <section className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4" key={approval.id}>
          <h3 className="font-semibold text-slate-950">{approval.stageName}</h3>
          <p className="mt-1 text-sm text-slate-600">A equipe enviou esta etapa para sua revisão.</p>
          {photos.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <figure className="overflow-hidden rounded-xl border border-white bg-white" key={photo.id}>
            {photo.downloadUrl ? <Image alt={photo.caption || `Foto da etapa ${approval.stageName}`} className="aspect-square w-full object-cover" height={480} src={photo.downloadUrl} unoptimized width={480} /> : <div className="grid aspect-square place-items-center text-xs text-slate-500">Imagem não disponível</div>}
            {photo.caption ? <figcaption className="p-2 text-xs text-slate-600">{photo.caption}</figcaption> : null}
          </figure>)}</div> : <p className="mt-3 text-sm text-rose-700">As fotos desta aprovação ainda não estão disponíveis. Avise o ateliê para reenviá-las.</p>}
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor={`approval-comment-${approval.id}`}>Comentário ou ajustes desejados</label>
          <Textarea className="mt-2 min-h-24" id={`approval-comment-${approval.id}`} maxLength={1000} onChange={(event) => setComments((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Opcional para aprovar; descreva o que precisa mudar se solicitar ajustes." value={comments[approval.id] ?? ''} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busyId === approval.id || !photos.length} onClick={() => void respond(approval.id, 'approved')}><Check size={16} />Aprovar etapa</Button>
            <Button disabled={busyId === approval.id || !photos.length} onClick={() => void respond(approval.id, 'changes_requested')} variant="secondary">Solicitar ajuste</Button>
          </div>
        </section>;
      })}
    </CardContent>
  </Card>;
}
