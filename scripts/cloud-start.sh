#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/cloud-env.sh
exec node scripts/cloud-start.mjs "${1:-dev}"
