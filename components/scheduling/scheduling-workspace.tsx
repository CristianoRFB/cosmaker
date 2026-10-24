'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock3, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';
import { eventSchema, eventTypes } from '@/schemas/event.schema';
import { memberCapacitySchema, productionSlotSchema, scheduleBlockSchema } from '@/schemas/schedule.schema';
import {
  allocateProductionTime, cancelProductionSlot, cancelScheduleBlock,
  createScheduleBlock, listScheduleWorkspace, saveMemberScheduleCapacity,
} from '@/repositories/schedule.repository';
import { cancelAtelierEvent, createAtelierEvent, listAtelierEvents, updateAtelierEvent } from '@/repositories/events.repository';
import type { AtelierEvent } from '@/types/event';
import type { ScheduleWorkspace } from '@/types/schedule';
import { formatScheduleTime, scheduleWallTimeToIso } from '@/lib/utils/schedule-time';

type Focus = 'agenda' | 'capacity' | 'blocks' | 'events' | 'timeline';
type EventDraft = { title: string; type: typeof eventTypes[number]; startDate: string; endDate: string; orderId: string; notes: string };
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const emptyEvent: EventDraft = { title: '', type: 'cosplay', startDate: '', endDate: '', orderId: '', notes: '' };

function dateValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}
function plusDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
function randomRequestId() { return globalThis.crypto.randomUUID().replaceAll('-', ''); }
function clockMinute(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed);
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível salvar as alterações. Tente novamente.';
}
function riskTone(level: string): 'red' | 'amber' | 'violet' | 'green' | 'neutral' {
  if (level === 'high') return 'red';
  if (level === 'medium') return 'amber';
  if (level === 'planning') return 'violet';
  if (level === 'clear') return 'green';
  return 'neutral';
}
function riskLabel(level: string) {
  return ({ high: 'Risco alto', medium: 'Atenção', planning: 'Planejamento incompleto', clear: 'Sem conflito conhecido', unknown: 'Prazo não informado' } as Record<string, string>)[level] ?? 'Sem avaliação';
}

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100';
const labelClass = 'grid gap-1.5 text-sm font-medium text-slate-700';

export function SchedulingWorkspace({ focus }: { focus: Focus }) {
  const { firebaseUser } = useAuth();
  const { atelierId, hasPermission, membershipValid, loading: tenantLoading } = useTenant();
  const canReadSchedule = hasPermission('schedule:read');
  const canWriteSchedule = hasPermission('schedule:write');
  const canManageTeam = hasPermission('team:manage');
  const canReadEvents = hasPermission('events:read');
  const canWriteEvents = hasPermission('events:write');
  const [fromDate] = useState(() => dateValue());
  const [toDate] = useState(() => plusDays(dateValue(), 30));
  const [workspace, setWorkspace] = useState<ScheduleWorkspace | null>(null);
  const [events, setEvents] = useState<AtelierEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEvent);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [allocationMemberId, setAllocationMemberId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (focus === 'events') {
        const result = await listAtelierEvents({ fromDate, toDate: plusDays(fromDate, 365) });
        setEvents(result.events);
        setWorkspace(null);
      } else {
        const result = await listScheduleWorkspace({ fromDate, toDate });
        setWorkspace(result);
        setEvents(result.events);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally { setLoading(false); }
  }, [focus, fromDate, toDate]);

  useEffect(() => {
    if (tenantLoading) return;
    const allowed = focus === 'events' ? canReadEvents : canReadSchedule;
    if (!atelierId || !membershipValid || !allowed) {
      setLoading(false);
      setWorkspace(null);
      setEvents([]);
      return;
    }
    void load();
  }, [atelierId, canReadEvents, canReadSchedule, focus, load, membershipValid, tenantLoading]);

  const members = workspace?.members ?? [];
  const visibleMembers = canManageTeam ? members : members.filter((member) => member.memberId === firebaseUser?.uid);
  const allocationMember = visibleMembers.find((member) => member.memberId === allocationMemberId) ?? visibleMembers[0];

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError));
      return false;
    } finally { setBusy(false); }
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>, memberId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weeklyHoursByWeekday = Object.fromEntries(weekdays.map((_, day) => [String(day), Number(form.get(`hours-${day}`) || 0)]));
    const payload = {
      memberId, weeklyHoursByWeekday,
      workdayStartMinute: clockMinute(String(form.get('workdayStart') || '09:00')),
      workdayEndMinute: clockMinute(String(form.get('workdayEnd') || '17:00')),
      timezone: String(form.get('timezone') || 'America/Sao_Paulo'),
    };
    const parsed = memberCapacitySchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise a capacidade informada.'); return; }
    await perform(() => saveMemberScheduleCapacity(parsed.data), 'Capacidade salva e validada com as alocações futuras.');
  }

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const [orderId, stageId] = String(form.get('stage') || '').split('|');
    const localStart = String(form.get('startAt') || '');
    const localEnd = String(form.get('endAt') || '');
    const deadline = String(form.get('deadline') || '');
    const assignedTo = String(form.get('assignedTo') || '');
    const member = visibleMembers.find((candidate) => candidate.memberId === assignedTo);
    let startAt: string; let endAt: string;
    try {
      if (!member) throw new Error('Selecione um responsável com capacidade configurada.');
      startAt = scheduleWallTimeToIso(localStart, member.timezone);
      endAt = scheduleWallTimeToIso(localEnd, member.timezone);
    } catch (conversionError) { setError(errorMessage(conversionError)); return; }
    const payload = {
      requestId: randomRequestId(), orderId, stageId, assignedTo, startAt, endAt,
      plannedHours: Number(form.get('plannedHours')),
      ...(deadline ? { deadline } : {}),
    };
    const parsed = productionSlotSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise a alocação informada.'); return; }
    const saved = await perform(() => allocateProductionTime(parsed.data), 'Horas alocadas no cronograma.');
    if (saved) formElement.reset();
  }

  async function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const allDay = form.get('allDay') === 'on';
    const startDate = String(form.get('startDate') || '');
    const endDate = String(form.get('endDate') || startDate);
    const payload = {
      requestId: randomRequestId(), memberId: String(form.get('memberId') || ''), startDate, endDate,
      startMinute: allDay ? 0 : clockMinute(String(form.get('startTime') || '09:00')),
      endMinute: allDay ? 1440 : clockMinute(String(form.get('endTime') || '10:00')),
      allDay, type: String(form.get('type') || 'pause'), title: String(form.get('title') || ''),
    };
    const parsed = scheduleBlockSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise o bloqueio informado.'); return; }
    await perform(() => createScheduleBlock(parsed.data), 'Bloqueio registrado na agenda.');
    formElement.reset();
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { ...eventDraft, orderId: eventDraft.orderId || null };
    const parsed = eventSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados do evento.'); return; }
    const action = editingEventId
      ? () => updateAtelierEvent({ ...parsed.data, eventId: editingEventId })
      : () => createAtelierEvent({ ...parsed.data, requestId: randomRequestId() });
    await perform(action, editingEventId ? 'Evento atualizado.' : 'Evento registrado.');
    setEditingEventId(null);
    setEventDraft(emptyEvent);
  }

  function editEvent(item: AtelierEvent) {
    setEditingEventId(item.id);
    setEventDraft({ title: item.title, type: item.type, startDate: item.startDate, endDate: item.endDate, orderId: item.orderId ?? '', notes: item.notes });
    setError('');
    setNotice('Edite os campos e salve as alterações.');
  }

  const nav = [
    ['/atelier/agenda', 'Agenda'], ['/atelier/agenda/capacidade', 'Capacidade'],
    ['/atelier/agenda/bloqueios', 'Bloqueios'], ['/atelier/producao/cronograma', 'Cronograma'], ['/atelier/eventos', 'Eventos'],
  ] as const;

  if (!tenantLoading && (!atelierId || !membershipValid || (focus === 'events' ? !canReadEvents : !canReadSchedule))) {
    return <Card><CardContent className="flex items-start gap-3 pt-5"><ShieldAlert aria-hidden="true" className="mt-0.5 text-amber-700" size={20} /><p className="text-sm text-slate-700">Seu perfil não tem permissão para consultar esta parte do planejamento.</p></CardContent></Card>;
  }

  return <div className="grid gap-5">
    <nav aria-label="Módulos da agenda" className="flex gap-2 overflow-x-auto pb-1">{nav.map(([href, label]) => <Link key={href} href={href} className="shrink-0 rounded-xl border border-violet-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-violet-50">{label}</Link>)}</nav>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">Período consultado: {formatDate(fromDate)} a {formatDate(focus === 'events' ? plusDays(fromDate, 365) : toDate)}. Horários usam o fuso cadastrado para cada responsável.</p>
      <Button variant="secondary" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} />Atualizar</Button>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
    {loading ? <Card><CardContent className="py-8 text-sm text-slate-500">Carregando agenda e capacidade…</CardContent></Card> : null}

    {!loading && focus === 'capacity' ? <section className="grid gap-4">{visibleMembers.length ? visibleMembers.map((member) => <Card key={member.memberId}>
      <CardHeader><CardTitle>{member.memberName}</CardTitle><CardDescription>{member.weeklyHours} horas por semana · {member.timezone}</CardDescription></CardHeader>
      <CardContent><form className="grid gap-4" onSubmit={(event) => void submitCapacity(event, member.memberId)}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{weekdays.map((day, index) => <label className={labelClass} key={day}>{day}<input aria-label={`${day}: horas semanais`} className={inputClass} defaultValue={member.weeklyHoursByWeekday[String(index)] ?? 0} min="0" max="16" step="0.25" name={`hours-${index}`} type="number" /></label>)}</div>
        <div className="grid gap-3 sm:grid-cols-3"><label className={labelClass}>Início do expediente<input className={inputClass} defaultValue={`${String(Math.floor(member.workdayStartMinute / 60)).padStart(2, '0')}:${String(member.workdayStartMinute % 60).padStart(2, '0')}`} name="workdayStart" type="time" /></label><label className={labelClass}>Fim do expediente<input className={inputClass} defaultValue={`${String(Math.floor(member.workdayEndMinute / 60)).padStart(2, '0')}:${String(member.workdayEndMinute % 60).padStart(2, '0')}`} name="workdayEnd" type="time" /></label><label className={labelClass}>Fuso horário<input className={inputClass} defaultValue={member.timezone || 'America/Sao_Paulo'} name="timezone" /></label></div>
        <div><Button disabled={busy || !canWriteSchedule} type="submit">Salvar capacidade</Button></div>
      </form></CardContent>
    </Card>) : <Card><CardContent className="py-8 text-sm text-slate-600">Nenhum membro visível. Configure a equipe ou solicite acesso de leitura à agenda.</CardContent></Card>}</section> : null}

    {!loading && focus === 'blocks' ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      {canWriteSchedule ? <Card><CardHeader><CardTitle>Novo bloqueio</CardTitle><CardDescription>Registre pausas, férias ou períodos indisponíveis. Os bloqueios reduzem a capacidade do dia.</CardDescription></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submitBlock(event)}>
        <label className={labelClass}>Responsável<select className={inputClass} name="memberId" required>{visibleMembers.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberName}</option>)}</select></label>
        <label className={labelClass}>Tipo<select className={inputClass} name="type"><option value="pause">Pausa</option><option value="leave">Ausência</option><option value="vacation">Férias</option><option value="other">Outro</option></select></label>
        <label className={labelClass}>Título<input className={inputClass} maxLength={100} minLength={2} name="title" placeholder="Ex.: férias" required /></label>
        <label className={labelClass}>Data inicial<input className={inputClass} defaultValue={fromDate} name="startDate" type="date" required /></label>
        <label className={labelClass}>Data final<input className={inputClass} defaultValue={fromDate} name="endDate" type="date" required /></label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-slate-700"><input className="size-4 accent-violet-700" name="allDay" type="checkbox" />Dia inteiro / período integral</label>
        <label className={labelClass}>Início<input className={inputClass} defaultValue="09:00" name="startTime" type="time" /></label>
        <label className={labelClass}>Fim<input className={inputClass} defaultValue="10:00" name="endTime" type="time" /></label>
        <div className="sm:col-span-2"><Button disabled={busy || !visibleMembers.length} type="submit"><Plus size={16} />Registrar bloqueio</Button></div>
      </form></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>Bloqueios no período</CardTitle></CardHeader><CardContent className="grid gap-3">{workspace?.blocks.filter((item) => item.status === 'active').length ? workspace.blocks.filter((item) => item.status === 'active').map((item) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4" key={item.id}><div><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.memberName} · {formatDate(item.date)}{item.allDay ? ' · dia inteiro' : ` · ${Math.floor(item.startMinute / 60).toString().padStart(2, '0')}:${String(item.startMinute % 60).padStart(2, '0')}–${Math.floor(item.endMinute / 60).toString().padStart(2, '0')}:${String(item.endMinute % 60).padStart(2, '0')}`}</p></div>{canWriteSchedule ? <Button aria-label={`Cancelar ${item.title}`} variant="danger" onClick={() => void perform(() => cancelScheduleBlock(item.groupId), 'Bloqueio cancelado.')} disabled={busy}><Trash2 size={15} />Cancelar</Button> : <Badge tone="neutral">Somente leitura</Badge>}</div>) : <p className="py-3 text-sm text-slate-600">Nenhum bloqueio ativo neste período.</p>}</CardContent></Card>
    </div> : null}

    {!loading && focus === 'events' ? <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {canWriteEvents ? <Card><CardHeader><CardTitle>{editingEventId ? 'Editar evento' : 'Novo evento'}</CardTitle><CardDescription>Registre convenções, datas de cosplay e prazos de peças vinculados a pedidos.</CardDescription></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => void submitEvent(event)}>
        <label className={labelClass}>Título<input className={inputClass} maxLength={100} minLength={2} onChange={(event) => setEventDraft((value) => ({ ...value, title: event.target.value }))} value={eventDraft.title} required /></label>
        <label className={labelClass}>Tipo<select className={inputClass} onChange={(event) => setEventDraft((value) => ({ ...value, type: event.target.value as EventDraft['type'] }))} value={eventDraft.type}>{eventTypes.map((type) => <option key={type} value={type}>{({ cosplay: 'Evento de cosplay', convention: 'Convenção', deadline: 'Prazo', prop_deadline: 'Prazo de peça / prop', other: 'Outro' } as Record<string, string>)[type]}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Início<input className={inputClass} onChange={(event) => setEventDraft((value) => ({ ...value, startDate: event.target.value }))} type="date" value={eventDraft.startDate} required /></label><label className={labelClass}>Fim<input className={inputClass} onChange={(event) => setEventDraft((value) => ({ ...value, endDate: event.target.value }))} type="date" value={eventDraft.endDate} required /></label></div>
        <label className={labelClass}>ID do pedido vinculado (opcional)<input className={inputClass} maxLength={150} onChange={(event) => setEventDraft((value) => ({ ...value, orderId: event.target.value }))} placeholder="ID salvo no Cosmaker OS" value={eventDraft.orderId} /></label>
        <label className={labelClass}>Observações<textarea className={`${inputClass} min-h-24`} maxLength={500} onChange={(event) => setEventDraft((value) => ({ ...value, notes: event.target.value }))} value={eventDraft.notes} /></label>
        <div className="flex flex-wrap gap-2"><Button disabled={busy} type="submit">{editingEventId ? 'Salvar alterações' : 'Registrar evento'}</Button>{editingEventId ? <Button disabled={busy} onClick={() => { setEditingEventId(null); setEventDraft(emptyEvent); }} variant="secondary">Cancelar edição</Button> : null}</div>
      </form></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>Eventos e prazos</CardTitle></CardHeader><CardContent className="grid gap-3">{events.length ? events.map((item) => <div className="rounded-xl border border-slate-100 p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-600">{formatDate(item.startDate)}{item.endDate !== item.startDate ? ` a ${formatDate(item.endDate)}` : ''} · {item.type.replaceAll('_', ' ')}</p>{item.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.notes}</p> : null}</div>{canWriteEvents ? <div className="flex gap-2"><Button variant="secondary" onClick={() => editEvent(item)} disabled={busy}>Editar</Button><Button variant="danger" onClick={() => void perform(() => cancelAtelierEvent(item.id), 'Evento cancelado.')} disabled={busy}><Trash2 size={15} />Cancelar</Button></div> : <Badge>Somente leitura</Badge>}</div></div>) : <p className="py-3 text-sm text-slate-600">Nenhum evento ativo no período consultado.</p>}</CardContent></Card>
    </div> : null}

    {!loading && (focus === 'agenda' || focus === 'timeline') ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(workspace?.capacityByDate ?? []).slice(0, 4).map((item) => <Card key={`${item.memberId}-${item.date}`}><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDate(item.date)}</p><p className="mt-2 text-lg font-bold text-slate-900">{Math.max(0, item.capacityHours - item.allocatedHours - item.blockedHours)} h disponíveis</p><p className="mt-1 text-xs text-slate-500">{item.allocatedHours} h alocadas · {item.blockedHours} h bloqueadas</p></CardContent></Card>)}</section>
      {canWriteSchedule ? <Card><CardHeader><CardTitle>Alocar horas de produção</CardTitle><CardDescription>O sistema valida expediente, capacidade diária, bloqueios e sobreposição antes de gravar.</CardDescription></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => void submitAllocation(event)}>
        <label className={labelClass}>Etapa do pedido<select className={inputClass} name="stage" required>{workspace?.stages.filter((stage) => !['completed', 'approved'].includes(stage.status)).map((stage) => <option key={`${stage.orderId}|${stage.id}`} value={`${stage.orderId}|${stage.id}`}>{stage.character || stage.orderId} · {stage.id} · {stage.status}</option>)}</select></label>
        <label className={labelClass}>Responsável<select className={inputClass} name="assignedTo" required value={allocationMember?.memberId ?? ''} onChange={(event) => setAllocationMemberId(event.target.value)}>{visibleMembers.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberName}{member.weeklyHours ? ` · ${member.weeklyHours} h/semana` : ' · capacidade não configurada'}</option>)}</select></label>
        <p className="text-sm text-slate-600 sm:col-span-2">Horários da alocação no fuso do responsável: {allocationMember?.timezone ?? 'capacidade não configurada'}.</p>
        <label className={labelClass}>Início<input className={inputClass} defaultValue={`${plusDays(fromDate, 1)}T09:00`} name="startAt" type="datetime-local" required /></label>
        <label className={labelClass}>Fim<input className={inputClass} defaultValue={`${plusDays(fromDate, 1)}T11:00`} name="endAt" type="datetime-local" required /></label>
        <label className={labelClass}>Horas planejadas<input className={inputClass} defaultValue="2" min="0.25" max="16" name="plannedHours" step="0.25" type="number" required /></label>
        <label className={labelClass}>Prazo da etapa<input className={inputClass} name="deadline" type="date" /></label>
        <div className="self-end"><Button disabled={busy || !visibleMembers.length || !workspace?.stages.some((stage) => !['completed', 'approved'].includes(stage.status))} type="submit"><Clock3 size={16} />Alocar no cronograma</Button></div>
      </form></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>Etapas e risco de atraso</CardTitle><CardDescription>O risco usa prazos de entrega e de etapas, evento registrado e alocações gravadas. Não há percentuais estimados.</CardDescription></CardHeader><CardContent className="grid gap-3">{workspace?.stages.length ? workspace.stages.map((stage) => <div className="grid gap-2 rounded-xl border border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={`${stage.orderId}-${stage.id}`}><div><p className="font-semibold text-slate-900">{stage.character || 'Pedido'} · {stage.id}</p><p className="mt-1 text-sm text-slate-600">{stage.clientName || 'Cliente'} · {stage.status} · {stage.scheduledHours} h alocadas{stage.deadline ? ` · prazo ${formatDate(stage.deadline)}` : ''}</p><p className="mt-1 text-xs text-slate-500">Responsável: {members.find((member) => member.memberId === stage.assignedTo)?.memberName ?? (stage.assignedTo ? 'Membro da equipe' : 'Não atribuído')}</p>{stage.riskReasons.length ? <ul className="mt-2 list-inside list-disc text-sm text-slate-600">{stage.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}</div><Badge className="h-fit" tone={riskTone(stage.riskLevel)}>{riskLabel(stage.riskLevel)}</Badge></div>) : <p className="py-3 text-sm text-slate-600">Nenhuma etapa de pedido ativo encontrada para este ateliê.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Alocações registradas</CardTitle></CardHeader><CardContent className="grid gap-3">{workspace?.slots.filter((slot) => slot.status === 'scheduled').length ? workspace.slots.filter((slot) => slot.status === 'scheduled').map((slot) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4" key={slot.id}><div><p className="font-semibold text-slate-900">{slot.stageName} · {slot.plannedHours} h</p><p className="mt-1 text-sm text-slate-600">{slot.assignedName} · {formatDate(slot.date)} · {formatScheduleTime(slot.startAt, slot.timezone)}–{formatScheduleTime(slot.endAt, slot.timezone)} · {slot.timezone}</p></div>{canWriteSchedule && (canManageTeam || slot.assignedTo === firebaseUser?.uid) ? <Button variant="danger" onClick={() => void perform(() => cancelProductionSlot(slot.id), 'Alocação cancelada e capacidade liberada.')} disabled={busy}><Trash2 size={15} />Cancelar</Button> : <Badge>Planejado</Badge>}</div>) : <p className="py-3 text-sm text-slate-600">Nenhuma alocação neste período.</p>}</CardContent></Card>
      {focus === 'agenda' ? <Card><CardHeader><CardTitle>Eventos próximos</CardTitle><CardDescription>Eventos ativos vinculados ao ateliê.</CardDescription></CardHeader><CardContent className="grid gap-3">{events.length ? events.slice(0, 8).map((item) => <div className="flex items-center gap-3 rounded-xl bg-violet-50/70 p-3" key={item.id}><CalendarDays className="shrink-0 text-violet-700" size={18} /><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-600">{formatDate(item.startDate)} · {item.type.replaceAll('_', ' ')}</p></div></div>) : <p className="text-sm text-slate-600">Ainda não há eventos ativos cadastrados.</p>}</CardContent></Card> : null}
    </> : null}
  </div>;
}
