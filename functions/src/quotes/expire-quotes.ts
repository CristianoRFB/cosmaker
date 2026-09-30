import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from '../admin';

const BATCH_SIZE = 100;

export const expireQuotes = onSchedule({ schedule: 'every 60 minutes', timeZone: 'UTC' }, async () => {
  // A quote remains valid for the whole date shown to the client. Expire it after that UTC date.
  const today = new Date().toISOString().slice(0, 10);
  const expired = await adminDb.collectionGroup('quotes')
    .where('status', '==', 'sent')
    .where('validUntil', '<', today)
    .orderBy('validUntil')
    .limit(BATCH_SIZE)
    .get();

  for (let offset = 0; offset < expired.docs.length; offset += 10) {
    const page = expired.docs.slice(offset, offset + 10);
    await Promise.all(page.map(async (candidate) => {
      const quoteRef = candidate.ref;
      const requestId = candidate.get('requestId');
      const requestRef = quoteRef.parent.parent?.collection('quoteRequests').doc(String(requestId));
      if (!requestRef) return;
      const auditRef = adminDb.collection('auditLogs').doc();

      await adminDb.runTransaction(async (transaction) => {
        const [quoteSnapshot, requestSnapshot] = await Promise.all([
          transaction.get(quoteRef), transaction.get(requestRef),
        ]);
        if (!quoteSnapshot.exists || quoteSnapshot.get('status') !== 'sent'
          || typeof quoteSnapshot.get('validUntil') !== 'string' || quoteSnapshot.get('validUntil') >= today) return;

        const quote = quoteSnapshot.data()!;
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
});
