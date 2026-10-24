import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { messageId, messageInput } from '../messages/access';
import { identity } from './order-file-bytes';
import { orderClientUid } from './client-ownership';
import { clientOrderView } from './client-order-view';

export const getClientOrder = onCall(async call => {
  const session = await identity(call.rawRequest);
  if (session.uid !== call.auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para consultar o pedido.');
  const data = messageInput(call.data, ['atelierId', 'orderId']);
  if (!messageId(data.atelierId) || !messageId(data.orderId)) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  const atelierId = data.atelierId; const orderId = data.orderId;
  return adminDb.runTransaction(async tx => {
    const [profile, atelier, order] = await Promise.all([
      tx.get(adminDb.doc(`users/${session.uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}`)),
      tx.get(adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`)),
    ]);
    if (profile.get('active') !== true || profile.get('accountType') !== 'client' || atelier.get('active') !== true || !order.exists
      || await orderClientUid(tx, atelierId, order.data()!) !== session.uid) throw new HttpsError('permission-denied', 'Este pedido não está disponível para sua conta.');
    return { order: clientOrderView(order) };
  });
});
