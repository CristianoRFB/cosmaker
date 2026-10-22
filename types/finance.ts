import type { summarizeFinance } from '../functions/src/finance/policy';
export type { FinanceBasis, FinanceCategory, FinanceKind, FinanceEntry } from '../functions/src/finance/policy';
export interface FinanceWorkspaceData {
  summary: ReturnType<typeof summarizeFinance>;
  entries: Array<import('../functions/src/finance/policy').FinanceEntry & { reversed: boolean }>;
  nextCursor: string | null; filteredCount: number; balanceAsOf: string; periodAppliesTo: 'ledger_only';
}
export interface FinanceFilters { orderId?: string; from?: string; to?: string; cursor?: string }
export interface FinanceEntryInput {
  kind: import('./finance').FinanceKind; basis: import('./finance').FinanceBasis;
  category: import('./finance').FinanceCategory; amountCents: number; description: string;
  effectiveDate: string; orderId: string | null; method?: string | null; reference?: string | null;
}
