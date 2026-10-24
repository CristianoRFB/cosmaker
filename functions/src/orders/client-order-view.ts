import type { DocumentSnapshot } from 'firebase-admin/firestore';

const orderFields = ['quoteId', 'requestId', 'clientId', 'clientName', 'email', 'character', 'franchise', 'category', 'description', 'status', 'priority', 'progress', 'amountPaid', 'amountRemaining', 'amountPaidCents', 'amountRemainingCents', 'totalAmountCents', 'agreementVersion', 'lifecycleVersion', 'planningNeedsReview', 'expectedDeliveryDate', 'eventDate', 'deliveryMethod'];
const agreementFields = ['version', 'sourceQuoteId', 'scope', 'materials', 'expectedDeliveryDate', 'totalCents', 'depositAmountCents'];
function pick(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(fields.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
}
function iso(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString() as string;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

/** One allowlist for list and detail. The original internal snapshot stays intact. */
export function clientOrderView(snapshot: DocumentSnapshot) {
  const value = snapshot.data()!;
  return { ...pick(value, orderFields), id: snapshot.id, atelierId: snapshot.ref.parent.parent!.id,
    approvedQuoteSnapshot: pick(value.approvedQuoteSnapshot, ['total', 'depositAmount', 'depositPercentage', 'expectedStartDate', 'expectedCompletionDate']),
    ...(value.currentAgreement ? { currentAgreement: pick(value.currentAgreement, agreementFields) } : {}),
    createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt),
    deliveredAt: iso(value.deliveredAt), completedAt: iso(value.completedAt) };
}
