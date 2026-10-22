#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/cloud-env.sh
node --version
java -version
npm ci --cache "$COSMAKER_CLOUD_CACHE/npm" --no-audit --no-fund
npm ci --prefix functions --cache "$COSMAKER_CLOUD_CACHE/npm" --no-audit --no-fund
npm run functions:build
for cosmaker_emulator in firestore storage pubsub; do
  node scripts/firebase-local-cli.mjs "setup:emulators:$cosmaker_emulator"
done
npm run build:local
