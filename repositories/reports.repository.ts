import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { OperationalPreferences, OperationalPreferencesResponse, OperationalReport, OperationalReportFilters } from '@/types/report';
export async function getOperationalPreferences() { return (await httpsCallable<Record<string, never>, OperationalPreferencesResponse>(requireFirebase().functions, 'getOperationalPreferences')({})).data; }
export async function saveOperationalPreferences(preferences: OperationalPreferences, requestId: string) { return (await httpsCallable(requireFirebase().functions, 'saveOperationalPreferences')({ ...preferences, requestId })).data; }
export async function getAtelierOperationalReport(filters: OperationalReportFilters = {}) { return (await httpsCallable<OperationalReportFilters, OperationalReport>(requireFirebase().functions, 'getAtelierOperationalReport')(filters)).data; }
