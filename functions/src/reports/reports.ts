import { createHash } from 'node:crypto';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from '../orders/access';
import { requireTenantWorkspaceIdentity } from '../commercial/access';
import { messageId, messageInput } from '../messages/access';
import { showcaseVersion } from '../showcase/policy';
import { parseScheduleDate, scheduleLocalDate } from '../scheduling/allocate-capacity';
import { financialOrder, summarizeFinance, type FinanceEntry, type FinanceOrder } from '../finance/policy';
import { operationalPreferences, reportPeriod, summarizeOperationalOrders, summarizeOperationalQuotes, type ReportOrder } from './policy';
function permission(member: FirebaseFirestore.DocumentData, required: string) {
  return ['owner', 'admin'].includes(member.role) || (Array.isArray(member.permissions) && (member.permissions.includes(required)
    || (['quotes:read', 'finance:read'].includes(required) && member.permissions.includes(required.replace(':read', ':write')))
    || (required === 'orders:read' && member.permissions.includes('orders:manage'))));
}
async function actor(tx: Transaction, atelierId: string, uid: string, settings = false) {
  const [atelier, profile, member] = await Promise.all([tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`users/${uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`))]);
  if (atelier.data()?.active !== true || profile.data()?.active !== true || profile.data()?.accountType !== 'atelier_member' || profile.data()?.atelierId !== atelierId || member.data()?.active !== true
    || (settings && !permission(member.data()!, 'atelier:settings'))) throw new HttpsError('permission-denied', 'O perfil não tem acesso a esta operação do ateliê.');
  return { atelier: atelier.data()!, member: member.data()! };
}
function preferences(stored: FirebaseFirestore.DocumentData | undefined, timezone: unknown) {
  try { return operationalPreferences(stored, timezone); } catch (error) { throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Preferências inválidas.'); }
}
function createdDate(value: unknown, timezone: string) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate() as Date; return Number.isFinite(date.getTime()) ? scheduleLocalDate(date.toISOString(), timezone) : null;
  }
  return null;
}
const status = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 80 ? value : 'unknown';
export const getOperationalPreferences = onCall(async (call) => {
  requireVerifiedIdentity(call.auth); messageInput(call.data, []);
  const identity = await requireTenantWorkspaceIdentity(call.auth!.uid, call.auth!.token);
  const canEdit = permission(identity.member, 'atelier:settings');
  const [stored, profile] = await Promise.all([adminDb.doc(`ateliers/${identity.atelierId}/preferences/operations`).get(), canEdit ? adminDb.doc(`publicAteliers/${identity.atelierId}`).get() : null]);
  const publicProfile = profile?.data();
  return { preferences: preferences(stored.data(), identity.atelier.timezone), canEdit, publicProfile: publicProfile && typeof publicProfile.slug === 'string' ? { slug: publicProfile.slug, name: publicProfile.name ?? '', tagline: publicProfile.tagline ?? '', brandColor: publicProfile.brandColor ?? '#6d28d9', published: publicProfile.published === true, quoteRequestsEnabled: publicProfile.quoteRequestsEnabled === true, version: showcaseVersion(publicProfile) } : null };
});
export const saveOperationalPreferences = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const identity = await requireTenantWorkspaceIdentity(call.auth!.uid, call.auth!.token);
  const data = messageInput(call.data, ['requestId', 'timezone', 'defaultReportDays', 'includeCancelledOrders', 'version']);
  if (!messageId(data.requestId)) throw new HttpsError('invalid-argument', 'Informe a chave da alteração.');
  let after;
  try { after = operationalPreferences({ timezone: data.timezone, defaultReportDays: data.defaultReportDays, includeCancelledOrders: data.includeCancelledOrders, version: data.version }, undefined); }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Revise as preferências.'); }
  if (!['timezone', 'defaultReportDays', 'includeCancelledOrders', 'version'].every((key) => Object.hasOwn(data, key))) throw new HttpsError('invalid-argument', 'Informe todas as preferências operacionais.');
  const root = adminDb.doc(`ateliers/${identity.atelierId}`); const ref = root.collection('preferences').doc('operations');
  const id = createHash('sha256').update(JSON.stringify([call.auth!.uid, data.requestId])).digest('hex'); const operation = root.collection('settingsOperations').doc(id);
  const fingerprint = JSON.stringify(after);
  return adminDb.runTransaction(async (tx) => {
    const currentActor = await actor(tx, identity.atelierId, call.auth!.uid, true);
    const [stored, previous] = await Promise.all([tx.get(ref), tx.get(operation)]);
    if (previous.exists) {
      if (previous.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição já foi usada com outros dados.');
      return { version: previous.data()!.version, alreadyApplied: true };
    }
    const before = preferences(stored.data(), currentActor.atelier.timezone);
    if (before.version !== after.version) throw new HttpsError('aborted', 'As preferências mudaram. Atualize antes de salvar.');
    const version = after.version + 1; if (!Number.isSafeInteger(version)) throw new HttpsError('failed-precondition', 'A versão excedeu o intervalo seguro.');
    const now = Timestamp.now(); tx.set(ref, { ...after, version, updatedAt: now }, { merge: true }); tx.create(operation, { fingerprint, version, createdAt: now });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: call.auth!.uid, atelierId: identity.atelierId, action: 'settings.operational_saved', entity: 'operational_preferences', entityId: 'operations', before, after: { ...after, version }, timestamp: now });
    return { version, alreadyApplied: false };
  });
});
export const getAtelierOperationalReport = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const identity = await requireTenantWorkspaceIdentity(call.auth!.uid, call.auth!.token);
  const data = messageInput(call.data, ['from', 'to', 'includeCancelled']);
  if ((data.from !== undefined && !parseScheduleDate(data.from)) || (data.to !== undefined && !parseScheduleDate(data.to)) || (data.includeCancelled !== undefined && typeof data.includeCancelled !== 'boolean')) throw new HttpsError('invalid-argument', 'Revise o período e os filtros.');
  return adminDb.runTransaction(async (tx) => {
    const current = await actor(tx, identity.atelierId, call.auth!.uid);
    const canOrders = permission(current.member, 'orders:read'); const canQuotes = permission(current.member, 'quotes:read'); const canFinance = permission(current.member, 'finance:read');
    if (!canOrders && !canQuotes && !canFinance) throw new HttpsError('permission-denied', 'Seu perfil não tem acesso aos indicadores deste ateliê.');
    const root = adminDb.doc(`ateliers/${identity.atelierId}`);
    const stored = await tx.get(root.collection('preferences').doc('operations')); const config = preferences(stored.data(), current.atelier.timezone);
    let period;
    try { period = reportPeriod(config, data.from, data.to, new Date()); } catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Período inválido.'); }
    const [orders, quotes, requests, ledger] = await Promise.all([
      canOrders || canFinance ? tx.get(root.collection('orders').limit(501)) : null,
      canQuotes ? tx.get(root.collection('quotes').limit(501)) : null,
      canQuotes ? tx.get(root.collection('quoteRequests').limit(501)) : null,
      canFinance ? tx.get(root.collection('financeEntries').limit(5001)) : null,
    ]);
    if ((orders?.size ?? 0) > 500 || (quotes?.size ?? 0) > 500 || (requests?.size ?? 0) > 500 || (ledger?.size ?? 0) > 5000) throw new HttpsError('resource-exhausted', 'O volume exige agregação paginada antes de exibir indicadores completos.');
    const orderRows: ReportOrder[] = orders?.docs.map((doc) => { const value = doc.data(); return { id: doc.id, character: typeof value.character === 'string' ? value.character.slice(0, 120) : 'Pedido', status: status(value.status),
      progress: typeof value.progress === 'number' && Number.isFinite(value.progress) && value.progress >= 0 && value.progress <= 100 ? value.progress : null,
      createdDate: createdDate(value.createdAt, config.timezone), expectedDeliveryDate: parseScheduleDate(value.expectedDeliveryDate) }; }) ?? [];
    const includeCancelled = typeof data.includeCancelled === 'boolean' ? data.includeCancelled : config.includeCancelledOrders;
    let finance = null;
    if (canFinance) {
      const financeOrders: FinanceOrder[] = orders!.docs.map((doc) => {
        const value = doc.data(); let amounts;
        try { amounts = financialOrder(value); } catch (error) { throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Os valores financeiros precisam de conciliação.'); }
        return { id: doc.id, character: typeof value.character === 'string' ? value.character.slice(0, 120) : 'Pedido', status: status(value.status), expectedDeliveryDate: value.expectedDeliveryDate, ...amounts };
      });
      const allEntries = ledger!.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FinanceEntry);
      if (allEntries.some((entry) => !parseScheduleDate(entry.effectiveDate) || !Number.isSafeInteger(entry.amountCents) || !['expense', 'income', 'payment'].includes(entry.kind) || !['planned', 'actual'].includes(entry.basis))) throw new HttpsError('failed-precondition', 'Há lançamentos financeiros inconsistentes que precisam de conciliação.');
      const entries = allEntries.filter((entry) => entry.effectiveDate >= period.from && entry.effectiveDate <= period.to);
      finance = summarizeFinance(entries, financeOrders);
    }
    const quoteRows = (snapshot: FirebaseFirestore.QuerySnapshot | null) => snapshot?.docs.map((doc) => ({ status: status(doc.data().status), createdDate: createdDate(doc.data().createdAt, config.timezone) })) ?? [];
    return { period, preferences: config, includeCancelled, permissions: { orders: canOrders, quotes: canQuotes, finance: canFinance },
      orders: canOrders ? summarizeOperationalOrders(orderRows, period, includeCancelled) : null,
      quotes: canQuotes ? summarizeOperationalQuotes(quoteRows(quotes), period) : null,
      requests: canQuotes ? summarizeOperationalQuotes(quoteRows(requests), period) : null,
      finance, asOf: new Date().toISOString(), financialPeriodAppliesTo: 'ledger_only' };
  }, { readOnly: true });
});
