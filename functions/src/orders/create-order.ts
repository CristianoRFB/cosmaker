import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { adminDb } from '../admin';

export const createOrderFromApprovedQuote = onDocumentUpdated('ateliers/{atelierId}/quotes/{quoteId}', async (event) => {
  const before = event.data?.before.data();
  const quote = event.data?.after.data();
  if (!before || !quote || before.status === 'approved' || quote.status !== 'approved') return;

  const { atelierId, quoteId } = event.params;
  const atelier = adminDb.collection('ateliers').doc(atelierId);
  const quoteRef = atelier.collection('quotes').doc(quoteId);
  const orderRef = atelier.collection('orders').doc(quoteId);
  const requestRef = atelier.collection('quoteRequests').doc(String(quote.requestId));
  const itemQuery = quoteRef.collection('approvedItems');
  const referenceQuery = requestRef.collection('references');
  const auditRef = adminDb.collection('auditLogs').doc();
  const historyRef = orderRef.collection('statusHistory').doc();

  await adminDb.runTransaction(async (transaction) => {
    const existingOrder = await transaction.get(orderRef);
    if (existingOrder.exists) return;
    const [requestSnapshot, itemSnapshots, referenceSnapshots, profileSnapshots] = await Promise.all([
      transaction.get(requestRef), transaction.get(itemQuery), transaction.get(referenceQuery),
      typeof quote.clientId === 'string'
        ? transaction.get(atelier.collection('measurementProfiles')
          .where('clientId', '==', quote.clientId)
          .where('active', '==', true)
          .orderBy('updatedAt', 'desc')
          .limit(1))
        : Promise.resolve(null),
    ]);
    if (!requestSnapshot.exists) return;

    const request = requestSnapshot.data()!;
    const measurementProfile = profileSnapshots?.docs[0] ?? null;
    const measurementSnapshots = measurementProfile
      ? await transaction.get(measurementProfile.ref.collection('measurements'))
      : null;
    const now = FieldValue.serverTimestamp();
    transaction.create(orderRef, {
      quoteId,
      requestId: quote.requestId,
      clientId: typeof quote.clientId === 'string' ? quote.clientId : null,
      clientName: typeof request.name === 'string' ? request.name : 'Cliente',
      email: String(quote.email).trim().toLowerCase(),
      character: request.character,
      franchise: request.franchise,
      category: request.category,
      description: request.description,
      status: 'waiting_deposit',
      priority: request.urgency === 'urgent' ? 'high' : 'normal',
      progress: 0,
      expectedDeliveryDate: request.desiredDeliveryDate,
      approvedQuoteSnapshot: quote.approvedSnapshot,
      createdAt: now,
      updatedAt: now,
    });
    itemSnapshots.docs.forEach((item) => transaction.set(orderRef.collection('items').doc(item.id), { ...item.data(), sourceQuoteItemId: item.id }));
    referenceSnapshots.docs.forEach((reference) => transaction.set(orderRef.collection('files').doc(reference.id), {
      ...reference.data(), source: 'quote_request', createdAt: now,
    }));
    measurementSnapshots?.docs.forEach((measurement) => transaction.create(orderRef.collection('measurementSnapshot').doc(measurement.id), {
      ...measurement.data(),
      sourceProfileId: measurementProfile!.id,
      sourceMeasurementId: measurement.id,
      profileName: measurementProfile!.data().name ?? null,
      capturedAt: now,
    }));
    transaction.create(historyRef, {
      status: 'waiting_deposit',
      actorId: quote.approvedBy,
      source: 'quote_approved',
      createdAt: now,
    });
    transaction.set(auditRef, {
      actorId: quote.approvedBy,
      atelierId,
      action: 'order.created_from_approved_quote',
      entity: 'order',
      entityId: quoteId,
      before: null,
      after: { quoteId, status: 'waiting_deposit', total: quote.approvedSnapshot?.total },
      timestamp: now,
    });
  });
});
