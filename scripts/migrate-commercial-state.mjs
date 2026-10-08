import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));

/** Only explicit, contract-valid legacy assignments are candidates for migration. */
export function resolveLegacyCommercialState(data, validateState) {
  const planId = typeof data.planId === 'string' ? data.planId : data.plan;
  const subscriptionStatus = data.subscriptionStatus;
  if ((subscriptionStatus === 'trial' || subscriptionStatus === 'demo') && planId !== 'premium') return null;
  if (subscriptionStatus === 'demo' && data.demoWorkspace !== true) return null;
  try {
    const state = validateState({
      planId,
      subscriptionStatus,
      trialUntil: data.trialUntil ?? null,
      entitlementOverrides: {},
      limitOverrides: {},
    });
    if (subscriptionStatus === 'trial' && !state.trialUntil) return null;
    // The shared datetime validator requires ISO with an explicit timezone before normalization.
    if (state.trialUntil !== null && state.trialUntil !== undefined) {
      state.trialUntil = new Date(state.trialUntil).toISOString();
    }
    return state;
  } catch {
    return null;
  }
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function migrate() {
  const { initializeApp, getApps } = requireFromFunctions('firebase-admin/app');
  const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
  let validateCommercialState;
  try {
    ({ validateCommercialState } = requireFromFunctions('./lib/commercial/entitlements.js'));
  } catch {
    throw new Error('Execute npm run functions:build para carregar o contrato comercial compartilhado antes da migração.');
  }
  const apply = process.argv.includes('--apply');
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || (emulator ? 'demo-cosmaker' : '');
  const confirmedProject = argument('confirm-project');

  if (!projectId) throw new Error('Defina FIREBASE_ADMIN_PROJECT_ID; no Emulator, o projeto demo-cosmaker é selecionado automaticamente.');
  if (apply && confirmedProject !== projectId) {
    throw new Error('Gravação recusada. Confirme explicitamente o destino com --confirm-project=<mesmo-id-do-projeto>.');
  }
  if (apply && !emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG) {
    throw new Error('Gravação fora do Emulator exige credenciais Admin configuradas e o project ID confirmado.');
  }

  const app = getApps()[0] ?? initializeApp({ projectId }, `commercial-migration-${Date.now()}`);
  const db = getFirestore(app);
  const snapshot = await db.collection('ateliers').select('plan', 'planId', 'subscriptionStatus', 'trialUntil', 'demoWorkspace').get();
  let eligible = 0;
  let pending = 0;
  let alreadyAssigned = 0;
  let failed = 0;

  for (const atelier of snapshot.docs) {
    const data = atelier.data();
    const state = resolveLegacyCommercialState(data, validateCommercialState);
    if (!state) {
      pending += 1;
      continue;
    }

    const stateRef = db.doc(`ateliers/${atelier.id}/commercial/state`);
    if (!apply) {
      eligible += 1;
      continue;
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(stateRef);
        if (existing.exists) return 'already-assigned';
        transaction.create(stateRef, state);
        return 'created';
      });
      if (result === 'created') eligible += 1;
      else alreadyAssigned += 1;
    } catch {
      // Per-tenant errors are counted without logging tenant IDs or business data.
      failed += 1;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    project: projectId,
    scanned: snapshot.size,
    eligibleOrMigrated: eligible,
    pendingUnchanged: pending,
    alreadyAssigned,
    failed,
    productionMigrationPerformedByThisTask: false,
  }, null, 2));
  await app.delete();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await migrate();
}
