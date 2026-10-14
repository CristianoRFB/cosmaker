export function parseScheduleDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

export function scheduleDateRange(from: string, through: string, maximumDays = 31): string[] | null {
  const start = parseScheduleDate(from);
  const end = parseScheduleDate(through);
  if (!start || !end || start > end) return null;
  const days: string[] = [];
  for (let cursor = new Date(`${start}T12:00:00.000Z`); cursor <= new Date(`${end}T12:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10));
    if (days.length > maximumDays) return null;
  }
  return days;
}

export function scheduleWeekday(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function dateTimeParts(value: string, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${fields.year}-${fields.month}-${fields.day}`,
    minute: Number(fields.hour) * 60 + Number(fields.minute),
  };
}

export function scheduleLocalDate(value: string, timeZone: string): string | null {
  try { return dateTimeParts(value, timeZone)?.date ?? null; } catch { return null; }
}

export function scheduleLocalMinute(value: string, timeZone: string): number | null {
  try { return dateTimeParts(value, timeZone)?.minute ?? null; } catch { return null; }
}

export function validScheduleTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && parseScheduleDate(value.slice(0, 10)) !== null
    && Number.isFinite(Date.parse(value));
}

export function scheduleIntervalsOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export function validScheduleTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}
