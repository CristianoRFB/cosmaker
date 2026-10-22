import { parseScheduleDate, scheduleLocalDate, validScheduleTimezone } from '../scheduling/allocate-capacity';
export interface OperationalPreferences { timezone: string; defaultReportDays: number; includeCancelledOrders: boolean; version: number }
export interface ReportOrder { id: string; character: string; status: string; progress: number | null; createdDate: string | null; expectedDeliveryDate: string | null }
export interface ReportQuote { status: string; createdDate: string | null }
export class ReportPolicyError extends Error {}
export function operationalPreferences(stored: Record<string, unknown> | undefined, atelierTimezone: unknown): OperationalPreferences {
  const timezone = stored && Object.hasOwn(stored, 'timezone') ? stored.timezone : atelierTimezone ?? 'America/Sao_Paulo';
  const defaultReportDays = stored && Object.hasOwn(stored, 'defaultReportDays') ? stored.defaultReportDays : 30;
  const includeCancelledOrders = stored && Object.hasOwn(stored, 'includeCancelledOrders') ? stored.includeCancelledOrders : true;
  const version = stored && Object.hasOwn(stored, 'version') ? stored.version : 0;
  if (!validScheduleTimezone(timezone) || typeof defaultReportDays !== 'number' || !Number.isSafeInteger(defaultReportDays) || defaultReportDays < 1 || defaultReportDays > 366
    || typeof includeCancelledOrders !== 'boolean' || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) throw new ReportPolicyError('As preferências operacionais precisam ser revisadas.');
  return { timezone, defaultReportDays, includeCancelledOrders, version };
}
export function reportPeriod(preferences: OperationalPreferences, from: unknown, to: unknown, now: Date) {
  const today = scheduleLocalDate(now.toISOString(), preferences.timezone);
  if (!today) throw new ReportPolicyError('Não foi possível interpretar a data no fuso do ateliê.');
  const end = to === undefined ? today : parseScheduleDate(to);
  const startDate = new Date(`${end || today}T00:00:00.000Z`); startDate.setUTCDate(startDate.getUTCDate() - preferences.defaultReportDays + 1);
  const start = from === undefined ? parseScheduleDate(startDate.toISOString().slice(0, 10)) : parseScheduleDate(from);
  if (!start || !end || start > end) throw new ReportPolicyError('Informe um período válido com início anterior ao fim.');
  return { from: start, to: end, today, timezone: preferences.timezone };
}
function statuses(rows: Array<{ status: string }>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
export function summarizeOperationalOrders(rows: ReportOrder[], period: { from: string; to: string; today: string }, includeCancelled: boolean) {
  const visible = rows.filter((row) => includeCancelled || !['cancelled', 'refunded'].includes(row.status));
  const inPeriod = (value: string | null) => !!value && value >= period.from && value <= period.to;
  const cohort = visible.filter((row) => inPeriod(row.createdDate));
  const finalStates = new Set(['delivered', 'completed', 'cancelled', 'refunded']);
  const productionStates = new Set(['confirmed', 'waiting_materials', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'waiting_final_payment', 'ready_to_ship', 'paused']);
  const due = visible.filter((row) => !finalStates.has(row.status) && inPeriod(row.expectedDeliveryDate));
  const production = cohort.filter((row) => productionStates.has(row.status));
  const knownProgress = production.filter((row): row is ReportOrder & { progress: number } => row.progress !== null);
  return { total: cohort.length, byStatus: statuses(cohort), undatedCount: visible.filter((row) => !row.createdDate).length,
    production: { total: production.length, byStatus: statuses(production), averageProgress: knownProgress.length ? Math.round(knownProgress.reduce((total, row) => total + row.progress, 0) / knownProgress.length) : null, missingProgress: production.length - knownProgress.length },
    deadlines: { openDueInPeriod: due.length, overdue: due.filter((row) => row.expectedDeliveryDate! < period.today).length,
      upcoming: due.sort((a, b) => a.expectedDeliveryDate!.localeCompare(b.expectedDeliveryDate!) || a.id.localeCompare(b.id)).map((row) => ({ id: row.id, character: row.character, expectedDeliveryDate: row.expectedDeliveryDate, status: row.status, overdue: row.expectedDeliveryDate! < period.today })) } };
}
export function summarizeOperationalQuotes(rows: ReportQuote[], period: { from: string; to: string }) {
  const cohort = rows.filter((row) => row.createdDate && row.createdDate >= period.from && row.createdDate <= period.to);
  return { total: cohort.length, byStatus: statuses(cohort), undatedCount: rows.filter((row) => !row.createdDate).length };
}
