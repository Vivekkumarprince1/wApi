#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  ".github/workflows/ci.yml"
  "docker-compose.yml"
  "deploy/helm/connectsphere/Chart.yaml"
  "deploy/helm/connectsphere/values.yaml"
  "packages/contracts/package.json"
)

services=(
  "apps/admin-portal"
  "apps/customer-portal"
  "services/api-gateway"
  "services/auth-service"
  "services/campaign-service"
  "services/billing-service"
  "services/service-provider"
  "services/automation-service"
  "services/chat-service"
  "services/contact-service"
  "services/webhook-ingestor"
  "services/websocket-gateway"
)

missing=0

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "::error file=$file::Required deployment file is missing"
    missing=1
  fi
done

for service in "${services[@]}"; do
  if [[ ! -f "$service/package.json" ]]; then
    echo "::error file=$service/package.json::Missing package manifest"
    missing=1
  fi

  if [[ ! -f "$service/Dockerfile" ]]; then
    echo "::error file=$service/Dockerfile::Missing Dockerfile"
    missing=1
  fi

  if [[ -f "$service/package.json" ]]; then
    node -e '
      const fs = require("fs");
      const file = process.argv[1];
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!pkg.scripts || !pkg.scripts.build) {
        console.error(`::error file=${file}::Missing npm build script`);
        process.exit(1);
      }
    ' "$service/package.json" || missing=1
  fi
done

if git ls-files -- "*.env" | grep -q .; then
  echo "::warning::One or more .env files are tracked. Move production secrets to AKS secrets or External Secrets before deploying."
fi

if [[ "$missing" -ne 0 ]]; then
  echo "Production readiness checks failed."
  exit 1
fi

echo "Production readiness checks passed."
