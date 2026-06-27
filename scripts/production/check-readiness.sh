#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

required_files=(
  ".github/workflows/ci.yml"
  ".github/workflows/deploy-cloud-run.yml"
  "packages/contracts/package.json"
  "services/api-gateway/Dockerfile"
  "services/auth-service/Dockerfile"
  "services/contact-service/Dockerfile"
  "services/chat-service/Dockerfile"
  "services/billing-service/Dockerfile"
  "services/campaign-service/Dockerfile"
  "services/automation-service/Dockerfile"
  "services/service-provider/Dockerfile"
  "services/webhook-ingestor/Dockerfile"
  "services/websocket-gateway/Dockerfile"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "Missing required file: ${file}" >&2
    exit 1
  fi
done

if git ls-files | grep -E '(^|/)\.env($|\.local$)' >/dev/null; then
  echo "Tracked secret env files found. Remove them from git before deploying." >&2
  git ls-files | grep -E '(^|/)\.env($|\.local$)' >&2
  exit 1
fi

echo "Production readiness checks passed."
