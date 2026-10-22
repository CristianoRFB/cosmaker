import type { summarizeOperationalOrders, summarizeOperationalQuotes } from '../functions/src/reports/policy';
import type { FinanceWorkspaceData } from './finance';
import type { PublicShowcaseProfile } from './portfolio';
export type { OperationalPreferences } from '../functions/src/reports/policy';
export interface OperationalPreferencesResponse { preferences: import('./report').OperationalPreferences; canEdit: boolean; publicProfile: PublicShowcaseProfile | null }
export interface OperationalReport {
  period: { from: string; to: string; today: string; timezone: string }; preferences: import('./report').OperationalPreferences; includeCancelled: boolean;
  permissions: { orders: boolean; quotes: boolean; finance: boolean };
  orders: ReturnType<typeof summarizeOperationalOrders> | null; quotes: ReturnType<typeof summarizeOperationalQuotes> | null; requests: ReturnType<typeof summarizeOperationalQuotes> | null;
  finance: FinanceWorkspaceData['summary'] | null; asOf: string; financialPeriodAppliesTo: 'ledger_only';
}
export interface OperationalReportFilters { from?: string; to?: string; includeCancelled?: boolean }
