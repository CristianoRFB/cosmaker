import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Read-only inventory. Refuse production project IDs and every non-loopback endpoint.
const projectId = process.env.GCLOUD_PROJECT;
const endpoint = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (projectId !== 'demo-cosmaker' || !endpoint || !/^(127\.0\.0\.1|localhost):\d+$/.test(endpoint)) {
  throw new Error('Inventário permitido somente no Storage Emulator loopback de demo-cosmaker.');
}
const requireFunctions = createRequire(resolve('functions/package.json'));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getStorage } = requireFunctions('firebase-admin/storage');
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, 'synthetic-token-inventory');
const groups = {};
let query = { prefix: 'ateliers/', maxResults: 250, autoPaginate: false };
try {
  while (query) {
    const [files, next] = await getStorage(app).bucket().getFiles(query);
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const family = /\/quoteRequests\/[^/]+\/references\//.test(file.name) ? 'quote_references'
        : /\/orders\/[^/]+\/production\//.test(file.name) ? 'production_photos'
          : /\/orders\/[^/]+\/attachments\//.test(file.name) ? 'order_attachments'
            : /\/portfolio\//.test(file.name) ? 'portfolio' : 'other_legacy';
      const group = groups[family] ||= { objects: 0, objectsWithTokenMetadata: 0 };
      group.objects++;
      if (String(metadata.metadata?.firebaseStorageDownloadTokens || '').trim()) group.objectsWithTokenMetadata++;
    }
    query = next;
  }
  // Neither object paths, tokens, personal metadata nor downloadable URLs are exported.
  console.log(JSON.stringify({ projectId, syntheticOnly: true, readOnly: true, groups }, null, 2));
} finally { await app.delete(); }
