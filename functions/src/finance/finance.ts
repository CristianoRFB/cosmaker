import { createHash } from 'node:crypto';
import { FieldPath, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { requireVerifiedIdentity } from '../orders/access';
import { validAgreementDate } from '../orders/change-policy';
import { cents, financeCategories, financialOrder, sumCents, summarizeFinance, type FinanceEntry, type FinanceOrder, type FinanceKind, type FinanceBasis, type FinanceCategory } from './policy';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const methods = ['pix', 'bank_transfer', 'cash', 'other'];
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
function input(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key))) {
    throw new HttpsError('invalid-argument', 'O formulário contém campos inválidos.');
  }
  return value as Record<string, unknown>;
}
function textField(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpsError('invalid-argument', 'Revise a descrição, o motivo ou a referência informada.');
  return value.trim();
}
function permission(member: FirebaseFirestore.DocumentData, write: boolean) {
  return ['owner', 'admin'].includes(member.role) || (Array.isArray(member.permissions)
    && (member.permissions.includes(write ? 'finance:write' : 'finance:read') || (!write && member.permissions.includes('finance:write'))));
}
async function identity(auth: { uid: string; token: Record<string, unknown> } | undefined, write = false) {
  requireVerifiedIdentity(auth);
  const actor = await requireTenantWorkspaceIdentity(auth!.uid, auth!.token);
  if (!permission(actor.member, write)) throw new HttpsError('permission-denied', 'Seu perfil não tem permissão financeira neste ateliê.');
  return actor;
}
async function activeActor(tx: Transaction, atelierId: string, uid: string) {
  const [atelier, profile, member] = await Promise.all([
    tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`users/${uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
  ]);
  if (atelier.data()?.active !== true || profile.data()?.active !== true || profile.data()?.accountType !== 'atelier_member'
    || profile.data()?.atelierId !== atelierId || member.data()?.active !== true || !permission(member.data()!, true)) {
    throw new HttpsError('permission-denied', 'O vínculo ou a permissão financeira mudou. Atualize a página.');
  }
  if (atelier.data()?.demoWorkspace === true) throw new HttpsError('failed-precondition', 'A demonstração não aceita registros financeiros.');
}
function checkedOrder(data: FirebaseFirestore.DocumentData) {
  try { return financialOrder(data); } catch (error) {
    throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Os valores do pedido precisam ser revisados.');
  }
}
function checkedCents(value: unknown) {
  try { return cents(value, true); } catch { throw new HttpsError('invalid-argument', 'Informe um valor positivo em centavos inteiros e seguros.'); }
}
function audit(tx: Transaction, atelierId: string, uid: string, id: string, action: string, before: unknown, after: unknown, now: Timestamp) {
  tx.create(adminDb.collection('auditLogs').doc(), { actorId: uid, atelierId, action, entity: 'finance_entry', entityId: id, before, after, timestamp: now });
}
function paymentBalances(total: number, paid: number) {
  cents(paid); cents(total - paid);
  return { amountPaidCents: paid, amountPaid: paid / 100, amountRemainingCents: total - paid, amountRemaining: (total - paid) / 100 };
}

export const recordFinanceEntry = onCall(async (call) => {
  const actor = await identity(call.auth, true);
  const data = input(call.data, ['requestId', 'kind', 'basis', 'category', 'amountCents', 'description', 'effectiveDate', 'orderId', 'method', 'reference']);
  if (!validId(data.requestId) || !['expense', 'income', 'payment'].includes(String(data.kind))
    || !['planned', 'actual'].includes(String(data.basis)) || !financeCategories.includes(data.category as FinanceCategory)
    || !validAgreementDate(data.effectiveDate) || (data.orderId != null && !validId(data.orderId))) {
    throw new HttpsError('invalid-argument', 'Revise o tipo, a categoria, o pedido e a data do lançamento.');
  }
  const kind = data.kind as FinanceKind;
  const basis = data.basis as FinanceBasis;
  const orderId = typeof data.orderId === 'string' ? data.orderId : null;
  if ((kind === 'income' && orderId) || (kind === 'payment' && (!orderId || basis !== 'actual' || !methods.includes(String(data.method))))
    || (kind !== 'payment' && data.method != null)) {
    throw new HttpsError('invalid-argument', 'Receitas de pedidos devem ser registradas como recebimentos manuais.');
  }
  const entry = { kind, basis, category: data.category as FinanceCategory, amountCents: checkedCents(data.amountCents),
    description: textField(data.description, 3, 300), effectiveDate: data.effectiveDate, orderId,
    method: kind === 'payment' ? String(data.method) : null, reference: data.reference == null ? null : textField(data.reference, 0, 120) || null };
  const atelier = adminDb.doc(`ateliers/${actor.atelierId}`);
  const id = hash([call.auth!.uid, data.requestId]);
  const operation = atelier.collection('financeOperations').doc(id);
  const entryRef = atelier.collection('financeEntries').doc(id);
  const fingerprint = hash(entry);
  const result = await adminDb.runTransaction(async (tx) => {
    await activeActor(tx, actor.atelierId, call.auth!.uid);
    const previous = await tx.get(operation);
    if (previous.exists) {
      if (previous.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição já foi usada com outros valores.');
      return { entryId: id, alreadyApplied: true };
    }
    const orderRef = orderId ? atelier.collection('orders').doc(orderId) : null;
    const order = orderRef ? await tx.get(orderRef) : null;
    if (orderRef && !order?.exists) throw new HttpsError('not-found', 'O pedido não pertence a este ateliê.');
    const referenceRef = kind === 'payment' && entry.reference
      ? atelier.collection('financePaymentReferences').doc(hash([orderId, entry.reference.toLowerCase()])) : null;
    const referenceRecord = referenceRef ? await tx.get(referenceRef) : null;
    if (referenceRecord?.exists) throw new HttpsError('already-exists', 'Esta referência de recebimento já foi registrada neste pedido.');
    if (kind === 'payment') {
      if (!['confirmed', 'waiting_materials', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'waiting_final_payment', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'paused'].includes(order!.data()!.status)) {
        throw new HttpsError('failed-precondition', 'Confirme a entrada na tela do pedido antes de registrar outros recebimentos.');
      }
      const balance = checkedOrder(order!.data()!);
      if (entry.amountCents > balance.remainingCents) throw new HttpsError('failed-precondition', 'O recebimento excede o saldo registrado do pedido.');
      const now = Timestamp.now();
      tx.update(orderRef!, { ...paymentBalances(balance.revenueCents, sumCents(balance.receivedCents, entry.amountCents)), updatedAt: now });
      tx.create(orderRef!.collection('payments').doc(id), { type: entry.amountCents === balance.remainingCents ? 'final' : 'installment', amount: entry.amountCents / 100,
        amountCents: entry.amountCents, status: 'paid', method: entry.method, reference: entry.reference,
        effectiveDate: entry.effectiveDate, confirmedBy: call.auth!.uid, source: 'manual_finance', financeEntryId: id, paidAt: now, createdAt: now, updatedAt: now });
      if (referenceRef) tx.create(referenceRef, { entryId: id, createdAt: now });
    }
    const now = Timestamp.now();
    const stored = { ...entry, paymentId: kind === 'payment' ? id : null, reversesEntryId: null, reason: null, createdAt: now, actorId: call.auth!.uid };
    tx.create(entryRef, stored);
    tx.create(operation, { fingerprint, entryId: id, createdAt: now });
    audit(tx, actor.atelierId, call.auth!.uid, id, 'finance.entry_recorded', null, stored, now);
    return { entryId: id, alreadyApplied: false };
  });
  return result;
});

export const reverseFinanceEntry = onCall(async (call) => {
  const actor = await identity(call.auth, true);
  const data = input(call.data, ['requestId', 'entryId', 'reason', 'effectiveDate']);
  if (!validId(data.requestId) || !validId(data.entryId) || !validAgreementDate(data.effectiveDate)) throw new HttpsError('invalid-argument', 'Informe o lançamento e a data da correção.');
  const reason = textField(data.reason, 8, 500);
  const atelier = adminDb.doc(`ateliers/${actor.atelierId}`);
  const id = hash([call.auth!.uid, data.requestId]);
  const fingerprint = hash({ entryId: data.entryId, reason, effectiveDate: data.effectiveDate });
  return adminDb.runTransaction(async (tx) => {
    await activeActor(tx, actor.atelierId, call.auth!.uid);
    const operationRef = atelier.collection('financeOperations').doc(id);
    const reversalRef = atelier.collection('financeReversals').doc(data.entryId as string);
    const [operation, original, reversed] = await Promise.all([
      tx.get(operationRef), tx.get(atelier.collection('financeEntries').doc(data.entryId as string)), tx.get(reversalRef),
    ]);
    if (operation.exists) {
      if (operation.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição já foi usada com outros valores.');
      return { entryId: id, alreadyApplied: true };
    }
    if (!original.exists) throw new HttpsError('not-found', 'O lançamento não pertence a este ateliê.');
    const entry = original.data()!;
    if (entry.reversesEntryId || reversed.exists) throw new HttpsError('already-exists', 'O lançamento já foi compensado ou é uma compensação.');
    checkedCents(entry.amountCents);
    const now = Timestamp.now();
    if (entry.kind === 'payment') {
      if (!validId(entry.orderId) || !validId(entry.paymentId)) throw new HttpsError('failed-precondition', 'A referência do recebimento é inválida.');
      const orderRef = atelier.collection('orders').doc(entry.orderId);
      const paymentRef = orderRef.collection('payments').doc(entry.paymentId);
      const [order, payment] = await Promise.all([tx.get(orderRef), tx.get(paymentRef)]);
      if (!order.exists || payment.data()?.status !== 'paid' || payment.data()?.financeEntryId !== original.id
        || payment.data()?.amountCents !== entry.amountCents) throw new HttpsError('failed-precondition', 'O recebimento não corresponde ao histórico financeiro.');
      const balance = checkedOrder(order.data()!);
      if (balance.receivedCents < entry.amountCents) throw new HttpsError('failed-precondition', 'O valor a compensar excede os recebimentos do pedido.');
      tx.update(orderRef, { ...paymentBalances(balance.revenueCents, sumCents(balance.receivedCents, -entry.amountCents)), updatedAt: now });
      tx.update(paymentRef, { status: 'refunded', reversalEntryId: id, reversalReason: reason, reversedAt: now, updatedAt: now });
    }
    const stored = { kind: entry.kind, basis: entry.basis, category: entry.category, amountCents: -entry.amountCents,
      description: `Compensação: ${entry.description}`, effectiveDate: data.effectiveDate, orderId: entry.orderId,
      paymentId: entry.paymentId, method: entry.method, reference: entry.reference, reversesEntryId: original.id, reason, actorId: call.auth!.uid, createdAt: now };
    tx.create(atelier.collection('financeEntries').doc(id), stored);
    tx.create(reversalRef, { entryId: id, createdAt: now });
    tx.create(operationRef, { fingerprint, entryId: id, createdAt: now });
    audit(tx, actor.atelierId, call.auth!.uid, id, 'finance.entry_reversed', { entryId: original.id, amountCents: entry.amountCents }, stored, now);
    return { entryId: id, alreadyApplied: false };
  });
});

function projection(doc: FirebaseFirestore.QueryDocumentSnapshot): FinanceEntry {
  const entry = doc.data();
  return { id: doc.id, kind: entry.kind, basis: entry.basis, category: entry.category, amountCents: entry.amountCents,
    description: entry.description, effectiveDate: entry.effectiveDate, orderId: entry.orderId, paymentId: entry.paymentId,
    method: entry.method, reference: entry.reference, reversesEntryId: entry.reversesEntryId, reason: entry.reason,
    createdAt: entry.createdAt.toDate().toISOString() };
}
export const listFinanceWorkspace = onCall(async (call) => {
  const actor = await identity(call.auth);
  const data = input(call.data, ['orderId', 'from', 'to', 'cursor']);
  if ((data.orderId != null && !validId(data.orderId)) || (data.cursor != null && !validId(data.cursor))
    || (data.from != null && !validAgreementDate(data.from)) || (data.to != null && !validAgreementDate(data.to))
    || (typeof data.from === 'string' && typeof data.to === 'string' && data.from > data.to)) throw new HttpsError('invalid-argument', 'Revise o pedido, a página e o período.');
  const atelier = adminDb.doc(`ateliers/${actor.atelierId}`);
  // Explicit technical bounds fail closed; an incomplete dataset never produces an apparently complete metric.
  const [ledger, orders] = await Promise.all([
    atelier.collection('financeEntries').orderBy(FieldPath.documentId()).limit(5001).get(),
    data.orderId ? atelier.collection('orders').where(FieldPath.documentId(), '==', data.orderId).get() : atelier.collection('orders').limit(501).get(),
  ]);
  if (ledger.size > 5000 || orders.size > 500) throw new HttpsError('resource-exhausted', 'O volume exige paginação analítica antes de exibir totais confiáveis.');
  if (data.orderId && orders.empty) throw new HttpsError('not-found', 'O pedido não pertence a este ateliê.');
  const allEntries = ledger.docs.map(projection).filter((entry) => !data.orderId || entry.orderId === data.orderId);
  const entries = allEntries.filter((entry) => (!data.from || entry.effectiveDate >= String(data.from)) && (!data.to || entry.effectiveDate <= String(data.to)));
  const orderRows: FinanceOrder[] = orders.docs.map((doc) => {
    const order = doc.data();
    return { id: doc.id, character: typeof order.character === 'string' ? order.character : doc.id, status: order.status,
      expectedDeliveryDate: order.expectedDeliveryDate, ...checkedOrder(order) };
  });
  // Balance and agreement metrics are current snapshots; date filters apply to the immutable ledger only.
  const summary = summarizeFinance(entries, orderRows);
  const reversedIds = new Set(allEntries.filter((entry) => entry.reversesEntryId).map((entry) => entry.reversesEntryId));
  const sorted = entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const cursorIndex = data.cursor ? sorted.findIndex((entry) => entry.id === data.cursor) : -1;
  if (data.cursor && cursorIndex < 0) throw new HttpsError('invalid-argument', 'A página expirou. Atualize o histórico.');
  const page = sorted.slice(cursorIndex + 1, cursorIndex + 51);
  return { summary, entries: page.map((entry) => ({ ...entry, reversed: reversedIds.has(entry.id) })),
    nextCursor: sorted.length > cursorIndex + 51 ? page.at(-1)?.id ?? null : null,
    filteredCount: entries.length, balanceAsOf: new Date().toISOString(), periodAppliesTo: 'ledger_only' };
});
