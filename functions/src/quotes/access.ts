import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
export async function requireQuoteWriter(tx: Transaction, atelierId: string, uid: string) {
  const [atelier, profile, member] = await Promise.all([tx.get(adminDb.doc(`ateliers/${atelierId}`)), tx.get(adminDb.doc(`users/${uid}`)), tx.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`))]);
  const permissions = member.get('permissions');
  if (atelier.get('active') !== true || profile.get('active') !== true || profile.get('accountType') !== 'atelier_member' || profile.get('atelierId') !== atelierId || member.get('active') !== true
    || !(['owner', 'admin'].includes(member.get('role')) || (Array.isArray(permissions) && permissions.includes('quotes:write')))) throw new HttpsError('permission-denied', 'Seu perfil não pode alterar orçamentos deste ateliê.');
}
