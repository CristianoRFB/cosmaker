import { adminDb } from '../admin';

export function commercialStateRef(atelierId: string) {
  return adminDb.doc(`ateliers/${atelierId}/commercial/state`);
}

export function commercialConfigRef(atelierId: string) {
  return adminDb.doc(`ateliers/${atelierId}/commercial/config`);
}

export function isFunctionsEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

