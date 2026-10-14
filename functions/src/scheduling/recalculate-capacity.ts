export function sumScheduledHours(slots: Array<{ plannedHours: number; status?: string }>) {
  return slots.reduce((total, slot) => total + (slot.status === 'scheduled' ? slot.plannedHours : 0), 0);
}

export function scheduleBlockedHours(
  blocks: Array<{ allDay?: boolean; startMinute?: number; endMinute?: number; status?: string }>,
  capacityHours: number,
  workdayStartMinute: number,
  workdayEndMinute: number,
) {
  const intervals = blocks.flatMap((block) => {
    if (block.status && block.status !== 'active') return [];
    if (block.allDay) return [[workdayStartMinute, workdayEndMinute] as const];
    const start = Math.max(workdayStartMinute, Number(block.startMinute) || 0);
    const end = Math.min(workdayEndMinute, Number(block.endMinute) || 0);
    return end > start ? [[start, end] as const] : [];
  }).sort((a, b) => a[0] - b[0]);
  let minutes = 0;
  let start = -1;
  let end = -1;
  for (const [nextStart, nextEnd] of intervals) {
    if (start < 0) { start = nextStart; end = nextEnd; continue; }
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { minutes += end - start; start = nextStart; end = nextEnd; }
  }
  if (start >= 0) minutes += end - start;
  return Math.min(Math.max(0, capacityHours), minutes / 60);
}

export function scheduleRisk(input: {
  deliveryDate: string | null;
  eventDate: string | null;
  orderStatus: string;
  openStageDeadlines: string[];
  openStageCount: number;
  scheduledStageIds: string[];
  lateScheduledStageCount?: number;
}, today: string) {
  const terminal = ['completed', 'delivered', 'cancelled', 'refunded'].includes(input.orderStatus);
  const reasons: string[] = [];
  if (!terminal && input.deliveryDate && input.deliveryDate < today) reasons.push('Prazo de entrega vencido.');
  if (!terminal && input.deliveryDate && input.eventDate && input.deliveryDate > input.eventDate) reasons.push('A entrega prevista ocorre depois do evento informado.');
  if (!terminal && input.openStageDeadlines.some((deadline) => deadline < today)) reasons.push('Há etapa com prazo vencido.');
  if (!terminal && Number(input.lateScheduledStageCount) > 0) reasons.push('Há horas planejadas depois do prazo de uma etapa.');
  const hasUnscheduledStage = !terminal && input.openStageCount > input.scheduledStageIds.length;
  if (!terminal && hasUnscheduledStage) reasons.push('Há etapas sem alocação de horas.');
  if (reasons.some((reason) => reason === 'Prazo de entrega vencido.' || reason === 'A entrega prevista ocorre depois do evento informado.')) {
    return { level: 'high' as const, reasons };
  }
  if (reasons.some((reason) => reason === 'Há etapa com prazo vencido.' || reason === 'Há horas planejadas depois do prazo de uma etapa.')) return { level: 'medium' as const, reasons };
  if (hasUnscheduledStage) return { level: 'planning' as const, reasons };
  if (!input.deliveryDate && !input.eventDate && !input.openStageDeadlines.length) return { level: 'unknown' as const, reasons: ['Não há prazo cadastrado para avaliar o risco.'] };
  return { level: 'clear' as const, reasons: ['Sem conflito de prazo conhecido nos dados cadastrados.'] };
}
