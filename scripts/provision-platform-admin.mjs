import { createRequire } from 'node:module';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { applicationDefault, cert, getApps, initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const email = process.env.COSMAKER_ADMIN_EMAIL?.trim().toLowerCase();
const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId) throw new Error('Defina FIREBASE_ADMIN_PROJECT_ID para identificar o projeto autorizado.');
if (!email) throw new Error('Defina COSMAKER_ADMIN_EMAIL com o endereço da conta administrativa.');
if (!isEmulator && process.env.COSMAKER_CONFIRM_PLATFORM_ADMIN !== projectId) {
  throw new Error(`Operação de produção bloqueada. Para prosseguir conscientemente, defina COSMAKER_CONFIRM_PLATFORM_ADMIN=${projectId}.`);
}

if (Boolean(clientEmail) !== Boolean(privateKey)) throw new Error('Defina FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY juntos ou use Application Default Credentials.');
const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : isEmulator ? undefined : applicationDefault();
const app = getApps()[0] ?? initializeApp({ ...(credential ? { credential } : {}), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error?.code === 'auth/user-not-found') {
    const initialPassword = process.env.COSMAKER_ADMIN_INITIAL_PASSWORD;
    if (!initialPassword || initialPassword.length < 6) {
      throw new Error('A conta ainda não existe. Defina COSMAKER_ADMIN_INITIAL_PASSWORD em um ambiente seguro para criá-la.');
    }
    user = await auth.createUser({
      email,
      password: initialPassword,
      emailVerified: true,
      displayName: 'Administração Cosmaker OS',
      disabled: false,
    });
  } else {
    throw error;
  }
}
if (user.disabled) throw new Error('A conta está desativada no Firebase Authentication. Reative-a antes de provisionar o acesso.');
if (!user.emailVerified) throw new Error('Verifique o endereço no Firebase Authentication antes de conceder acesso administrativo.');

await auth.setCustomUserClaims(user.uid, { ...user.customClaims, platformAdmin: true });
await db.doc(`users/${user.uid}`).set({
  id: user.uid,
  name: user.displayName || email.split('@')[0],
  email,
  accountType: 'platform_admin',
  role: 'platform_admin',
  permissions: [],
  active: true,
  atelierId: FieldValue.delete(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`Acesso administrativo provisionado para ${email} no projeto ${projectId}.`);
console.log('A pessoa precisa renovar a sessão para receber a nova custom claim.');
await app.delete();
