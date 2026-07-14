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
  echo "::error::One or more .env files are tracked. Production secrets must use Kubernetes Secrets or Key Vault."
  missing=1
fi

production_values="deploy/gitops/production-values.yaml"
if [[ -f "$production_values" ]]; then
  if grep -E '^[[:space:]]+(NEXT_PUBLIC_APP_URL|CUSTOMER_PORTAL_URL|ADMIN_PORTAL_URL|ALLOWED_ORIGINS):.*http://' "$production_values" >/dev/null; then
    echo "::error file=$production_values::Public production URLs and origins must use HTTPS"
    missing=1
  fi

  required_flags=(
    'ALLOW_DEV_AUTH_MOCKS: "false"'
    'ALLOW_DEV_MEDIA_MOCKS: "false"'
    'ALLOW_UNSIGNED_DEV_WEBHOOKS: "false"'
    'ALLOW_UNSIGNED_DEV_PAYMENT_WEBHOOKS: "false"'
    'REQUIRE_WEBHOOK_SIGNATURE: "true"'
  )
  for flag in "${required_flags[@]}"; do
    if ! grep -Fq "$flag" "$production_values"; then
      echo "::error file=$production_values::Missing production safety flag: $flag"
      missing=1
    fi
  done

  required_secret_keys=(CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET)
  for key in "${required_secret_keys[@]}"; do
    if ! grep -Fq -- "- key: $key" "$production_values"; then
      echo "::error file=$production_values::Missing Key Vault mapping for $key"
      missing=1
    fi
  done
fi

if [[ "$missing" -ne 0 ]]; then
  echo "Production readiness checks failed."
  exit 1
fi

echo "Production readiness checks passed."
