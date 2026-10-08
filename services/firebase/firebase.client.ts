'use client';

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies FirebaseOptions;

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

export const firebaseApp: FirebaseApp | null = firebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(config)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;
export const functions: Functions | null = firebaseApp ? getFunctions(firebaseApp) : null;

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && auth && db && storage && functions) {
  const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  const port = (configuredValue: string | undefined, fallback: number) => {
    const configured = Number(configuredValue);
    return Number.isInteger(configured) && configured > 0 && configured <= 65535 ? configured : fallback;
  };
  connectAuthEmulator(auth, `http://${host}:${port(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT, 9099)}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, port(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT, 8080));
  connectStorageEmulator(storage, host, port(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT, 9199));
  connectFunctionsEmulator(functions, host, port(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT, 5001));
}

export function requireFirebase() {
  if (!firebaseConfigured || !auth || !db || !storage || !functions) {
    throw new Error('Configure as variáveis NEXT_PUBLIC_FIREBASE_* para conectar o Cosmaker OS.');
  }
  return { app: firebaseApp, auth, db, storage, functions };
}
