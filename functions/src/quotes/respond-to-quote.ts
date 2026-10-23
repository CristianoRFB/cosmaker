import { FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { productionId } from '../orders/production-configuration';
import { buildClientSearchPrefixes, clientEmailIndexId, normalizeClientSearch } from '../clients/client-data';

import { visibleClientQuotes } from './client-quotes';

type Decision = 'approved' | 'rejected' | 'request_changes';

export const respondToQuote = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para responder ao orçamento.');
  if (call.auth.token.email_verified !== true || typeof call.auth.token.email !== 'string') {
    throw new HttpsError('failed-precondition', 'Confirme seu e-mail para responder ao orçamento.');
  }
  if (!call.data || typeof call.data !== 'object' || Array.isArray(call.data) || Object.keys(call.data).some((key) => !['atelierId', 'quoteId', 'decision', 'comment'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da resposta.');
  const { atelierId, quoteId, decision, comment } = call.data as { atelierId?: unknown; quoteId?: unknown; decision?: unknown; comment?: unknown };
  if (typeof atelierId !== 'string' || !atelierId || typeof quoteId !== 'string' || !quoteId) {
    throw new HttpsError('invalid-argument', 'Ateliê e orçamento são obrigatórios.');
  }
  productionId(atelierId, 'Ateliê'); productionId(quoteId, 'Orçamento');
  if (comment !== undefined && typeof comment !== 'string') throw new HttpsError('invalid-argument', 'O comentário deve ser um texto.');
  if (!['approved', 'rejected', 'request_changes'].includes(String(decision))) throw new HttpsError('invalid-argument', 'Escolha uma resposta válida.');
  const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
  if (normalizedComment.length > 1000 || (decision === 'request_changes' && normalizedComment.length < 5)) {
    throw new HttpsError('invalid-argument', 'Explique a alteração desejada em até 1.000 caracteres.');
  }

  const atelier = adminDb.collection('ateliers').doc(atelierId);
  const quoteRef = atelier.collection('quotes').doc(quoteId);
  const responseRef = quoteRef.collection('responses').doc();
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [quoteSnapshot, tenant, profile] = await Promise.all([transaction.get(quoteRef), transaction.get(atelier), transaction.get(adminDb.doc(`users/${call.auth!.uid}`))]);
    if (tenant.get('active') !== true || profile.get('active') !== true || profile.get('accountType') !== 'client') throw new HttpsError('permission-denied', 'Seu perfil não pode responder a este orçamento.');
    if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'O orçamento não foi encontrado.');
    const quote = quoteSnapshot.data()!;
    if (!(await visibleClientQuotes(transaction, { uid: call.auth!.uid, email: call.auth!.token.email!.trim().toLowerCase() }, [quoteSnapshot])).length) throw new HttpsError('permission-denied', 'Este orçamento não está disponível para sua conta.');
    if (typeof quote.clientUserId === 'string' && quote.clientUserId !== call.auth!.uid) throw new HttpsError('permission-denied', 'Este orçamento está vinculado a outra conta.');
    if (String(quote.email).trim().toLowerCase() !== call.auth!.token.email!.trim().toLowerCase()) {
      throw new HttpsError('permission-denied', 'Este orçamento pertence a outro endereço verificado.');
    }
    if (quote.status !== 'sent') throw new HttpsError('failed-precondition', 'Este orçamento não aceita novas respostas.');
    if (typeof quote.validUntil === 'string' && quote.validUntil < new Date().toISOString().slice(0, 10)) {
      throw new HttpsError('failed-precondition', 'A validade do orçamento expirou. Peça ao ateliê uma nova proposta.');
    }

    const requestRef = atelier.collection('quoteRequests').doc(String(quote.requestId));
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError('failed-precondition', 'A solicitação original não foi encontrada.');
    const request = requestSnapshot.data()!;
    const normalizedEmail = call.auth!.token.email!.trim().toLowerCase();
    const clientCollection = atelier.collection('clients');
    const clientEmailIndexRef = atelier.collection('clientEmailIndex').doc(clientEmailIndexId(normalizedEmail));
    const [clientEmailIndex, matchingClients] = await Promise.all([
      transaction.get(clientEmailIndexRef),
      transaction.get(clientCollection.where('email', '==', normalizedEmail).limit(2)),
    ]);
    const indexedClientId = clientEmailIndex.data()?.clientId;
    let matchingClient: DocumentSnapshot | undefined = matchingClients.docs[0];
    if (clientEmailIndex.exists) {
      if (typeof indexedClientId !== 'string' || !indexedClientId || indexedClientId.includes('/')) {
        throw new HttpsError('failed-precondition', 'O vínculo de e-mail do cadastro precisa ser revisado.');
      }
      const indexedClient = await transaction.get(clientCollection.doc(indexedClientId));
      if (!indexedClient.exists) throw new HttpsError('failed-precondition', 'O índice de e-mail aponta para um cadastro ausente.');
      if (matchingClients.docs.some((client) => client.id !== indexedClientId)) {
        throw new HttpsError('already-exists', 'Há cadastros duplicados para este e-mail e o vínculo precisa ser revisado.');
      }
      matchingClient = indexedClient;
    } else if (matchingClients.docs.length > 1) {
      throw new HttpsError('already-exists', 'Há cadastros duplicados para este e-mail e o vínculo precisa ser revisado.');
    }
    // Preserve an existing CRM link even if its contact email was edited separately.
    if (typeof quote.clientId === 'string' && quote.clientId) matchingClient = await transaction.get(clientCollection.doc(quote.clientId));
    const matchingClientData = matchingClient?.data() ?? {};
    if (typeof matchingClientData.userId === 'string' && matchingClientData.userId !== call.auth!.uid) {
      throw new HttpsError('permission-denied', 'Este cadastro de cliente já está vinculado a outra conta.');
    }
    const clientRef = matchingClient?.ref ?? clientCollection.doc(call.auth!.uid);
    const existingUserClient = matchingClient ? null : await transaction.get(clientRef);
    if (existingUserClient?.exists && typeof existingUserClient.data()?.userId === 'string' && existingUserClient.data()?.userId !== call.auth!.uid) {
      throw new HttpsError('permission-denied', 'Este cadastro de cliente já está vinculado a outra conta.');
    }
    const clientId = clientRef.id;

    const reply = decision as Decision;
    const now = Timestamp.now();
    const items = reply === 'approved' ? await transaction.get(quoteRef.collection('items')) : null;
    const newStatus = reply === 'request_changes' ? quote.status : reply;
    transaction.create(responseRef, {
      decision: reply,
      comment: normalizedComment,
      actorId: call.auth!.uid,
      email: call.auth!.token.email,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(clientRef, {
      ...(matchingClient?.data() ?? existingUserClient?.data() ?? {}),
      id: clientId,
      userId: call.auth!.uid,
      name: typeof request.name === 'string' ? request.name : '',
      nameSearch: normalizeClientSearch(typeof request.name === 'string' ? request.name : ''),
      email: normalizedEmail,
      emailSearch: normalizeClientSearch(normalizedEmail),
      searchPrefixes: buildClientSearchPrefixes(typeof request.name === 'string' ? request.name : '', normalizedEmail),
      ...(typeof request.phone === 'string' && request.phone ? { phone: request.phone } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      ...(!matchingClient && !existingUserClient?.exists ? { createdAt: FieldValue.serverTimestamp(), totalSpent: 0, orderCount: 0 } : {}),
    }, { merge: true });
    transaction.set(clientEmailIndexRef, { clientId, updatedAt: FieldValue.serverTimestamp() });

    if (reply === 'request_changes') {
      transaction.update(requestRef, { clientId, clientUserId: call.auth!.uid, status: 'adjustment_requested', updatedAt: now });
      transaction.update(quoteRef, { clientId, clientUserId: call.auth!.uid, lastClientResponseAt: now, updatedAt: now });
    } else if (reply === 'approved') {
      const approvedItemsRef = quoteRef.collection('approvedItems');
      items!.docs.forEach((item) => transaction.set(approvedItemsRef.doc(item.id), { ...item.data(), snapshotAt: now }));
      transaction.update(quoteRef, {
        clientUserId: call.auth!.uid,
        clientId,
        status: 'approved',
        approvedAt: now,
        approvedBy: call.auth!.uid,
        clientComment: normalizedComment,
        approvedSnapshot: {
          requestId: quote.requestId,
          materialsCost: quote.materialsCost,
          laborCost: quote.laborCost,
          otherCost: quote.otherCost ?? 0,
          urgencyFee: quote.urgencyFee,
          shipping: quote.shipping,
          discount: quote.discount,
          subtotal: quote.subtotal,
          total: quote.total,
          depositPercentage: quote.depositPercentage,
          depositAmount: quote.depositAmount,
          validUntil: quote.validUntil,
          expectedStartDate: quote.expectedStartDate ?? null,
          expectedCompletionDate: quote.expectedCompletionDate ?? null,
          approvedAt: now,
        },
        updatedAt: now,
      });
      transaction.update(requestRef, { clientId, clientUserId: call.auth!.uid, status: 'approved', updatedAt: now });
    } else {
      transaction.update(quoteRef, { clientId, clientUserId: call.auth!.uid, status: 'rejected', rejectedAt: now, rejectedBy: call.auth!.uid, clientComment: normalizedComment, updatedAt: now });
      transaction.update(requestRef, { clientId, clientUserId: call.auth!.uid, status: 'rejected', updatedAt: now });
    }
    transaction.set(auditRef, {
      actorId: call.auth!.uid,
      atelierId,
      action: reply === 'request_changes' ? 'quote.client_adjustment_requested' : `quote.client_${reply}`,
      entity: 'quote',
      entityId: quoteId,
      before: { status: quote.status, total: quote.total },
      after: { status: newStatus, comment: normalizedComment },
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { quoteId, decision };
});
