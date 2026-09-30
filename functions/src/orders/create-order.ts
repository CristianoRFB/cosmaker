import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { adminDb } from '../admin';
import { defaultProductionStages } from './production-template';

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
  const paymentRef = orderRef.collection('payments').doc('deposit');
  const stageRefs = defaultProductionStages.map((stage) => orderRef.collection('productionStages').doc(stage.id));

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
    const depositAmount = Number(quote.approvedSnapshot?.depositAmount) || 0;
    const total = Number(quote.approvedSnapshot?.total) || 0;
    const initialStatus = depositAmount > 0 ? 'waiting_deposit' : 'confirmed';
    transaction.create(orderRef, {
      quoteId,
      requestId: quote.requestId,
      clientId: typeof quote.clientId === 'string' ? quote.clientId : null,
      clientUserId: typeof quote.approvedBy === 'string' ? quote.approvedBy : null,
      clientName: typeof request.name === 'string' ? request.name : 'Cliente',
      email: String(quote.email).trim().toLowerCase(),
      character: request.character,
      franchise: request.franchise,
      category: request.category,
      description: request.description,
      status: initialStatus,
      priority: request.urgency === 'urgent' ? 'high' : 'normal',
      progress: 0,
      amountPaid: 0,
      amountRemaining: total,
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
    if (depositAmount > 0) {
      transaction.create(paymentRef, {
        type: 'deposit', amount: depositAmount, method: null, status: 'pending',
        gateway: null, gatewayPaymentId: null, createdAt: now, updatedAt: now,
      });
    } else {
      stageRefs.forEach((stageRef, index) => transaction.create(stageRef, {
        ...defaultProductionStages[index], atelierId, orderId: quoteId,
        status: 'pending', progress: 0, createdAt: now, updatedAt: now,
      }));
    }
    transaction.create(historyRef, {
      status: initialStatus,
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
      after: { quoteId, status: initialStatus, total, depositAmount },
      timestamp: now,
    });
  });
});
