import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderRecord } from '@/types/order';
import type { ProductionStageStatus } from '@/types/production';

const stageStatus: Record<ProductionStageStatus, string> = {
  pending: 'A iniciar', in_progress: 'Em andamento', waiting_approval: 'Aguardando aprovação',
  approved: 'Aprovada', completed: 'Concluída', blocked: 'Bloqueada',
};

function badgeTone(status: ProductionStageStatus) {
  if (status === 'completed' || status === 'approved') return 'green' as const;
  if (status === 'blocked') return 'red' as const;
  if (status === 'waiting_approval') return 'amber' as const;
  if (status === 'in_progress') return 'violet' as const;
  return 'neutral' as const;
}

export function ProductionTimeline({ record, clientView = false }: { record: OrderRecord; clientView?: boolean }) {
  const stages = record.productionStages;
  return <Card>
    <CardHeader><CardTitle>Acompanhamento da produção</CardTitle><p className="text-sm text-slate-600">Etapas e registros do projeto, atualizados pela equipe do ateliê.</p></CardHeader>
    <CardContent>
      {stages.length ? <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => {
          const photos = record.productionPhotos.filter((photo) => photo.stageId === stage.id && (!clientView || photo.visibleToClient));
          const pendingApproval = record.approvals.some((approval) => approval.stageId === stage.id && approval.status === 'pending');
          return <li className="rounded-2xl border border-slate-100 p-4" key={stage.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Etapa {stage.order + 1}</p><h3 className="mt-1 font-semibold text-slate-950">{stage.name}</h3></div><Badge tone={badgeTone(stage.status)}>{stageStatus[stage.status]}</Badge></div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Progresso</span><strong className="text-slate-800">{stage.progress}%</strong></div>
            <div aria-label={`${stage.name}: ${stage.progress}%`} className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, Math.max(0, stage.progress))}%` }} /></div>
            {stage.notes ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">{stage.notes}</p> : null}
            {stage.requiresClientApproval ? <p className="mt-3 text-xs text-slate-500">Esta etapa exige sua aprovação{pendingApproval ? ' antes de a produção continuar' : ''}.</p> : null}
            {photos.length ? <div className="mt-4 grid grid-cols-2 gap-2">{photos.map((photo) => <figure className="overflow-hidden rounded-xl bg-slate-100" key={photo.id}>
              {photo.downloadUrl ? <Image alt={photo.caption || `Progresso em ${stage.name}`} className="aspect-[4/3] w-full object-cover" height={480} src={photo.downloadUrl} unoptimized width={640} /> : <div aria-label="Imagem indisponível" className="grid aspect-[4/3] place-items-center text-xs text-slate-500">Imagem não disponível</div>}
              {photo.caption ? <figcaption className="p-2 text-xs leading-4 text-slate-600">{photo.caption}</figcaption> : null}
              {!clientView && !photo.visibleToClient ? <span className="block px-2 pb-2 text-[11px] font-semibold text-amber-700">Visível apenas ao ateliê</span> : null}
            </figure>)}</div> : null}
          </li>;
        })}
      </ol> : <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-4 text-sm leading-6 text-slate-600">
        {record.order.status === 'waiting_deposit'
          ? 'As etapas de produção serão liberadas após a equipe confirmar o recebimento da entrada.'
          : 'A equipe ainda não iniciou as etapas deste pedido.'}
      </div>}
    </CardContent>
  </Card>;
}
