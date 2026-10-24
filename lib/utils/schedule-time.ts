export function formatScheduleTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone }).format(new Date(value));
}

/** Interpret a datetime-local as a wall clock in the assignee's IANA timezone. */
export function scheduleWallTimeToIso(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe data e horário válidos.');
  const target = Date.parse(`${value}:00.000Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 16) !== value) throw new Error('Informe data e horário válidos.');
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch { throw new Error('O responsável precisa de um fuso horário válido na capacidade.'); }
  function wallClock(instant: number) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value: part }) => [type, part]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  // Probe both sides of a timezone transition. A skipped or repeated wall clock
  // must be rejected instead of silently choosing a different working hour.
  const candidates = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = target + hours * 3_600_000;
    const offset = Date.parse(`${wallClock(probe)}:00.000Z`) - probe;
    const candidate = target - offset;
    if (wallClock(candidate) === value) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error('Esse horário é inexistente ou ambíguo no fuso do responsável. Escolha outro horário.');
  return new Date([...candidates][0]).toISOString();
}
