import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from '../admin';
import { parseScheduleDate } from '../scheduling/allocate-capacity';

const BATCH_SIZE = 100;

export const expireQuotes = onSchedule({ schedule: 'every 60 minutes', timeZone: 'UTC' }, async () => {
  // A quote remains valid for the whole date shown to the client. Expire it after that UTC date.
  const today = new Date().toISOString().slice(0, 10);
  const expiredQuery = adminDb.collectionGroup('quotes')
    .where('status', '==', 'sent')
    .where('validUntil', '<', today)
    .orderBy('validUntil')
    .limit(BATCH_SIZE);

  let expired = await expiredQuery.get();
  while (!expired.empty) {

    for (let offset = 0; offset < expired.docs.length; offset += 10) {
      const page = expired.docs.slice(offset, offset + 10);
      await Promise.all(page.map(async (candidate) => {
        const quoteRef = candidate.ref;
        const parts = quoteRef.path.split('/');
        if (parts.length !== 4 || parts[0] !== 'ateliers' || parts[2] !== 'quotes') return;
        const requestId = candidate.get('requestId');
        if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(requestId)) return;
        const requestRef = quoteRef.parent.parent?.collection('quoteRequests').doc(String(requestId));
        if (!requestRef) return;
        const auditRef = adminDb.collection('auditLogs').doc();

        await adminDb.runTransaction(async (transaction) => {
          const [quoteSnapshot, requestSnapshot] = await Promise.all([
            transaction.get(quoteRef), transaction.get(requestRef),
          ]);
          if (!quoteSnapshot.exists || quoteSnapshot.get('status') !== 'sent'
            || !parseScheduleDate(quoteSnapshot.get('validUntil')) || quoteSnapshot.get('validUntil') >= today) return;

          const quote = quoteSnapshot.data()!;
          if (typeof quote.total !== 'number' || !Number.isFinite(quote.total) || quote.total < 0) return;
          const now = Timestamp.now();
          transaction.update(quoteRef, { status: 'expired', expiredAt: now, updatedAt: now });
          if (requestSnapshot.exists && requestSnapshot.get('activeQuoteId') === quoteSnapshot.id) {
            transaction.update(requestRef, { status: 'expired', updatedAt: now });
          }
          transaction.set(auditRef, {
            actorId: 'system',
            atelierId: quoteRef.parent.parent?.id,
            action: 'quote.expired',
            entity: 'quote',
            entityId: quoteSnapshot.id,
            before: { status: quote.status, total: quote.total },
            after: { status: 'expired', total: quote.total },
            timestamp: FieldValue.serverTimestamp(),
          });
        });
      }));
    }
    // Invalid/foreign legacy records are preserved, so always advance the
    // snapshot cursor rather than rereading their unchanged first page forever.
    if (expired.size < BATCH_SIZE) break;
    expired = await expiredQuery.startAfter(expired.docs[expired.docs.length - 1]).get();
  }
});
