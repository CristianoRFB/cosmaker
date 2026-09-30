import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';

type ItemInput = { description: string; category: 'material' | 'labor' | 'other'; quantity: number; unitPrice: number };
type Input = {
  atelierId: string;
  requestId: string;
  items: ItemInput[];
  urgencyFee: number;
  shipping: number;
  discount: number;
  validUntil: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  depositPercentage: number;
};

function fail(message: string): never { throw new HttpsError('invalid-argument', message); }
function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function amount(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000_000) fail(`${label} precisa ser um valor válido.`);
  return value;
}
function isoDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) fail(`${label} precisa ser uma data válida.`);
  return value;
}
function parseItems(value: unknown): ItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) fail('Adicione de 1 a 100 itens ao orçamento.');
  return value.map((item) => {
    if (!item || typeof item !== 'object') fail('Um item do orçamento é inválido.');
    const row = item as Record<string, unknown>;
    if (typeof row.description !== 'string' || row.description.trim().length < 2 || row.description.trim().length > 160) fail('A descrição de cada item precisa ter entre 2 e 160 caracteres.');
    if (!['material', 'labor', 'other'].includes(String(row.category))) fail('A categoria de um item é inválida.');
    const quantity = amount(row.quantity, 'Quantidade');
    if (quantity <= 0) fail('A quantidade precisa ser maior que zero.');
    return { description: row.description.trim(), category: row.category as ItemInput['category'], quantity, unitPrice: amount(row.unitPrice, 'Preço unitário') };
  });
}

async function canWriteQuotes(atelierId: string, uid: string) {
  const [member, atelier] = await Promise.all([
    adminDb.doc(`ateliers/${atelierId}/members/${uid}`).get(),
    adminDb.doc(`ateliers/${atelierId}`).get(),
  ]);
  const data = member.data();
  return atelier.exists && atelier.data()?.active === true && member.exists && data?.active === true
    && (['owner', 'admin'].includes(String(data.role)) || data?.permissions?.includes('quotes:write'));
}

export const createQuoteDraft = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na conta do ateliê para criar um orçamento.');
  const data = call.data as Partial<Input>;
  if (typeof data.atelierId !== 'string' || !data.atelierId || typeof data.requestId !== 'string' || !data.requestId) fail('Ateliê e solicitação são obrigatórios.');
  if (!(await canWriteQuotes(data.atelierId, call.auth.uid))) throw new HttpsError('permission-denied', 'Você não tem permissão para criar orçamentos neste ateliê.');

  const items = parseItems(data.items);
  const urgencyFee = amount(data.urgencyFee, 'Taxa de urgência');
  const shipping = amount(data.shipping, 'Frete');
  const discount = amount(data.discount, 'Desconto');
  const depositPercentage = amount(data.depositPercentage, 'Percentual de entrada');
  if (depositPercentage > 100) fail('A entrada não pode ultrapassar 100%.');
  const validUntil = isoDate(data.validUntil, 'Validade');
  const today = new Date().toISOString().slice(0, 10);
  if (validUntil < today) fail('A validade do orçamento precisa ser hoje ou uma data futura.');
  const expectedStartDate = data.expectedStartDate ? isoDate(data.expectedStartDate, 'Previsão de início') : undefined;
  const expectedCompletionDate = data.expectedCompletionDate ? isoDate(data.expectedCompletionDate, 'Previsão de conclusão') : undefined;
  if (expectedStartDate && expectedCompletionDate && expectedCompletionDate < expectedStartDate) fail('A conclusão precisa ser posterior ao início.');

  const lineItems = items.map((item) => ({ ...item, total: money(item.quantity * item.unitPrice) }));
  const costs = lineItems.reduce((sum, item) => ({ ...sum, [item.category]: sum[item.category] + item.total }), { material: 0, labor: 0, other: 0 });
  const materialsCost = money(costs.material);
  const laborCost = money(costs.labor);
  const otherCost = money(costs.other);
  const subtotal = money(materialsCost + laborCost + otherCost + urgencyFee + shipping);
  if (discount > subtotal) fail('O desconto não pode ser maior que o subtotal.');
  const total = money(subtotal - discount);
  const depositAmount = money(total * depositPercentage / 100);

  const atelier = adminDb.collection('ateliers').doc(data.atelierId);
  const requestRef = atelier.collection('quoteRequests').doc(data.requestId);
  const quoteRef = atelier.collection('quotes').doc();
  const createdItemRefs = lineItems.map(() => quoteRef.collection('items').doc());
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError('not-found', 'A solicitação não foi encontrada neste ateliê.');
    const request = requestSnapshot.data()!;
    if (['approved', 'rejected', 'expired'].includes(String(request.status))) throw new HttpsError('failed-precondition', 'Esta solicitação já foi encerrada.');
    const previousId = typeof request.activeQuoteId === 'string' ? request.activeQuoteId : null;
    const previousRef = previousId ? atelier.collection('quotes').doc(previousId) : null;
    const previousSnapshot = previousRef ? await transaction.get(previousRef) : null;
    const now = FieldValue.serverTimestamp();

    if (previousRef && previousSnapshot?.exists && ['draft', 'sent'].includes(String(previousSnapshot.data()?.status))) {
      transaction.update(previousRef, { status: 'superseded', supersededAt: now, updatedAt: now });
    }
    transaction.set(quoteRef, {
      atelierId: data.atelierId,
      requestId: data.requestId,
      clientId: typeof request.clientId === 'string' ? request.clientId : null,
      email: String(request.email).trim().toLowerCase(),
      status: 'draft',
      materialsCost, laborCost, otherCost, urgencyFee, shipping, discount,
      subtotal, total, depositPercentage, depositAmount,
      validUntil, ...(expectedStartDate ? { expectedStartDate } : {}), ...(expectedCompletionDate ? { expectedCompletionDate } : {}),
      createdBy: call.auth!.uid,
      createdAt: now,
      updatedAt: now,
    });
    lineItems.forEach((item, index) => transaction.set(createdItemRefs[index], { ...item, createdAt: now }));
    transaction.update(requestRef, { status: 'under_review', activeQuoteId: quoteRef.id, updatedAt: now });
    transaction.set(auditRef, {
      actorId: call.auth!.uid,
      atelierId: data.atelierId,
      action: 'quote.draft_created',
      entity: 'quote',
      entityId: quoteRef.id,
      before: previousSnapshot?.exists ? { quoteId: previousId, status: previousSnapshot.data()?.status } : null,
      after: { requestId: data.requestId, status: 'draft', total, depositAmount },
      timestamp: now,
    });
  });

  return { quoteId: quoteRef.id, subtotal, total, depositAmount };
});
