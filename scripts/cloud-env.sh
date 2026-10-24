#!/usr/bin/env bash
# Source from Cloud entrypoints. Preserve the inherited proxy and CA settings.
set -euo pipefail
COSMAKER_CLOUD_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/cosmaker-cloud"
mkdir -p "$COSMAKER_CLOUD_CACHE"
if [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)" != 22 ]]; then
  cosmaker_node_version=22.23.4
  case "$(uname -m)" in x86_64) cosmaker_arch=x64 ;; aarch64) cosmaker_arch=arm64 ;; *) echo 'Arquitetura Node não suportada.' >&2; return 1 ;; esac
  cosmaker_node_dir="$COSMAKER_CLOUD_CACHE/node-v$cosmaker_node_version-linux-$cosmaker_arch"
  if [[ ! -x "$cosmaker_node_dir/bin/node" ]]; then
    cosmaker_download="$(mktemp -d "$COSMAKER_CLOUD_CACHE/download.XXXXXX")"
    cosmaker_archive="node-v$cosmaker_node_version-linux-$cosmaker_arch.tar.xz"
    curl --fail --location --retry 2 --max-time 180 "https://nodejs.org/dist/v$cosmaker_node_version/$cosmaker_archive" -o "$cosmaker_download/$cosmaker_archive"
    curl --fail --location --retry 2 --max-time 60 "https://nodejs.org/dist/v$cosmaker_node_version/SHASUMS256.txt" -o "$cosmaker_download/SHASUMS256.txt"
    (cd "$cosmaker_download"; awk -v name="$cosmaker_archive" '$2 == name' SHASUMS256.txt > selected.sha256; test -s selected.sha256; sha256sum --check selected.sha256)
    tar -xJf "$cosmaker_download/$cosmaker_archive" -C "$COSMAKER_CLOUD_CACHE"
    rm -rf -- "$cosmaker_download"
  fi
  export PATH="$cosmaker_node_dir/bin:$PATH"
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]]
cosmaker_java_version="$(java -version 2>&1 | head -1)"
if [[ ! "$cosmaker_java_version" =~ \"(21|2[2-9]|[3-9][0-9])\. ]]; then
  echo 'A imagem Cloud precisa de Java 21 ou superior (openjdk-21-jre-headless). Consulte LOCAL_EMULATOR_RUNTIME.md.' >&2
  return 1
fi
export GCLOUD_PROJECT=demo-cosmaker GOOGLE_CLOUD_PROJECT=demo-cosmaker
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:19199
export FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:15001
export PUBSUB_EMULATOR_HOST=127.0.0.1:8085
# This entrypoint is exclusively for demo emulators, never a GCE identity.
export METADATA_SERVER_DETECTION=none
if [[ -x /usr/bin/chromium ]]; then export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium; fi
