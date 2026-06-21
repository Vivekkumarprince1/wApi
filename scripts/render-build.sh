#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:?usage: bash scripts/render-build.sh <service-or-app-dir>}"
shift

if [[ ! -f "$target_dir/package.json" ]]; then
  echo "No package.json found in $target_dir" >&2
  exit 1
fi

# Most backend services consume @wapi/contracts through file:../../packages/contracts.
# Build it first so npm packs a usable dist/ into each consumer install.
npm ci --include=dev --prefix packages/contracts
npm run build --prefix packages/contracts

npm ci --include=dev --prefix "$target_dir"

for mapping in "$@"; do
  env_key="${mapping%%=*}"
  hostport_key="${mapping#*=}"
  hostport="${!hostport_key:-}"
  if [[ -n "$hostport" ]]; then
    export "$env_key=http://$hostport"
  fi
done

npm run build --prefix "$target_dir"
