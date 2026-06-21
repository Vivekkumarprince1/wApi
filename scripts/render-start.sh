#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:?usage: bash scripts/render-start.sh <service-or-app-dir> [ENV_KEY=HOSTPORT_ENV ...]}"
shift

for mapping in "$@"; do
  env_key="${mapping%%=*}"
  hostport_key="${mapping#*=}"
  hostport="${!hostport_key:-}"
  if [[ -n "$hostport" ]]; then
    export "$env_key=http://$hostport"
  fi
done

cd "$target_dir"
npm run start
