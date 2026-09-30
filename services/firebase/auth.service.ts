'use client';

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  reload,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { requireFirebase } from './firebase.client';
import type { User } from '@/types/user';

function messageForAuthError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/weak-password': 'Use uma senha com pelo menos 8 caracteres.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes da conclusão.',
    'auth/unauthorized-domain': 'Este domínio ainda não está autorizado no Firebase Authentication.',
  };
  return messages[code ?? ''] ?? 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

async function createClientProfile(credential: UserCredential, name?: string) {
  const { db } = requireFirebase();
  const userRef = doc(db, 'users', credential.user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return;

  const profile: Omit<User, 'id'> = {
    name: name?.trim() || credential.user.displayName || 'Cliente',
    email: credential.user.email ?? '',
    ...(credential.user.photoURL ? { photoURL: credential.user.photoURL } : {}),
    accountType: 'client',
    role: 'client',
    permissions: [],
    active: true,
  };
  await setDoc(userRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function registerWithEmail(name: string, email: string, password: string) {
  try {
    const { auth } = requireFirebase();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credential.user, { displayName: name.trim() });
    await createClientProfile(credential, name);
    await sendEmailVerification(credential.user);
    return credential.user;
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const { auth } = requireFirebase();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await createClientProfile(credential);
    return credential.user;
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}

export async function loginWithGoogle() {
  try {
    const { auth } = requireFirebase();
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await createClientProfile(credential);
    return credential.user;
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}

export async function requestPasswordReset(email: string) {
  try {
    const { auth } = requireFirebase();
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}

export async function resendVerificationEmail() {
  try {
    const { auth } = requireFirebase();
    if (!auth.currentUser) throw new Error('Entre na sua conta para reenviar a verificação.');
    await sendEmailVerification(auth.currentUser);
  } catch (error) {
    if (error instanceof Error && !('code' in error)) throw error;
    throw new Error(messageForAuthError(error));
  }
}

export async function checkEmailVerification() {
  const { auth } = requireFirebase();
  if (!auth.currentUser) return false;
  try {
    await reload(auth.currentUser);
    return auth.currentUser.emailVerified;
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}

export async function logout() {
  try {
    const { auth } = requireFirebase();
    await signOut(auth);
  } catch (error) {
    throw new Error(messageForAuthError(error));
  }
}
