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
  "apps/career-portal"
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

google_login_dockerfiles=(
  "apps/admin-portal/Dockerfile"
  "apps/career-portal/Dockerfile"
  "apps/customer-portal/Dockerfile"
)
for dockerfile in "${google_login_dockerfiles[@]}"; do
  if ! grep -Fq 'ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true' "$dockerfile"; then
    echo "::error file=$dockerfile::Google login must default to visible in portal builds"
    missing=1
  fi
done

if ! grep -Fq "vars.GOOGLE_AUTH_ENABLED || 'true'" .github/workflows/deploy-aks-gitops.yml; then
  echo "::error file=.github/workflows/deploy-aks-gitops.yml::Google login build flag must default to true"
  missing=1
fi

while IFS= read -r client_file; do
  if grep -Fq '@/config/env' "$client_file"; then
    echo "::error file=$client_file::Client component imports the career portal server-only environment module"
    missing=1
  fi
done < <(rg -l '^"use client";' apps/career-portal/src -g '*.ts' -g '*.tsx')

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

contract_workflows=(
  ".github/workflows/ci.yml"
  ".github/workflows/deploy-aks-gitops.yml"
)

for service in "${services[@]}"; do
  package_file="$service/package.json"
  if [[ ! -f "$package_file" ]]; then
    continue
  fi
  if ! grep -Eq '"@(connectsphere|wapi)/contracts"' "$package_file"; then
    continue
  fi

  service_name="$(basename "$service")"
  for workflow in "${contract_workflows[@]}"; do
    if ! grep -Eq "name: '$service_name'.*needs_contracts: true" "$workflow"; then
      echo "::error file=$workflow::${service_name} depends on shared contracts but is not marked needs_contracts: true"
      missing=1
    fi
  done
done

if git ls-files -- "*.env" | grep -q .; then
  echo "::error::One or more .env files are tracked. Production secrets must use Kubernetes Secrets or Key Vault."
  missing=1
fi

production_values="deploy/gitops/production-values.yaml"
if [[ -f "$production_values" ]]; then
  if grep -Eq '^[[:space:]]+(registry:[[:space:]]*changeme|tag:[[:space:]]*latest)' "$production_values"; then
    echo "::error file=$production_values::Production images require a real registry and immutable non-latest tag"
    missing=1
  fi
  if grep -E '^[[:space:]]+(NEXT_PUBLIC_APP_URL|CUSTOMER_PORTAL_URL|ADMIN_PORTAL_URL|CAREER_PORTAL_URL|ALLOWED_ORIGINS):.*http://' "$production_values" >/dev/null; then
    echo "::error file=$production_values::Public production URLs and origins must use HTTPS"
    missing=1
  fi

  required_flags=(
    'APP_ENV: production'
    'RELEASE_VERSION: v1.0.0'
    'ALLOW_DEV_AUTH_MOCKS: "false"'
    'ALLOW_DEV_MEDIA_MOCKS: "false"'
    'ALLOW_UNSIGNED_DEV_WEBHOOKS: "false"'
    'ALLOW_UNSIGNED_DEV_PAYMENT_WEBHOOKS: "false"'
    'REQUIRE_WEBHOOK_SIGNATURE: "true"'
    'FEATURE_COMMERCE: "false"'
    'FEATURE_AI_FAQ: "false"'
    'FEATURE_META_ADS: "false"'
    'FEATURE_INSTAGRAM: "false"'
    'FEATURE_PETPOOJA: "false"'
    'FEATURE_ADVANCED_ANSWERBOT: "false"'
    'FEATURE_DEVELOPER_API: "false"'
    'FEATURE_FORMS: "false"'
  )
  for flag in "${required_flags[@]}"; do
    if ! grep -Fq "$flag" "$production_values"; then
      echo "::error file=$production_values::Missing production safety flag: $flag"
      missing=1
    fi
  done

  # Only enforce Key Vault objects that are required by enabled production
  # capabilities. Optional integrations must remain disabled rather than making
  # the CSI mount fail for every workload when their secrets are not provisioned.
  required_secret_keys=(BETTER_AUTH_SECRET)
  if grep -Fq 'NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true"' "$production_values"; then
    required_secret_keys+=(GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET)
  fi
  if grep -Fq 'RAZORPAY_ENABLED: "true"' "$production_values"; then
    required_secret_keys+=(RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET)
  fi
  for key in "${required_secret_keys[@]}"; do
    if ! grep -Fq -- "- key: $key" "$production_values"; then
      echo "::error file=$production_values::Missing Key Vault mapping for $key"
      missing=1
    fi
  done
fi

if grep -RIE --exclude-dir=node_modules --exclude-dir=dist --exclude='*.test.*' --exclude='*.spec.*' \
  '(dummy_key|dummy_secret|mock-fb-token|wamid\.mock|images\.unsplash\.com.*fallback)' services packages 2>/dev/null; then
  echo "::error::Known production mock or dummy credential pattern found"
  missing=1
fi

helm_template="deploy/helm/connectsphere/templates/deployments.yaml"
for required in 'readinessProbe:' 'livenessProbe:' 'startupProbe:' 'terminationGracePeriodSeconds:' 'maxUnavailable: 0'; do
  if ! grep -Fq "$required" "$helm_template"; then
    echo "::error file=$helm_template::Missing Kubernetes launch hardening: $required"
    missing=1
  fi
done

if [[ ! -f deploy/helm/connectsphere/templates/pdb.yaml ]]; then
  echo "::error::PodDisruptionBudget template is required"
  missing=1
fi

if [[ -f "$production_values" ]] && command -v helm >/dev/null 2>&1; then
  if ! helm template connectsphere deploy/helm/connectsphere -f "$production_values" >/dev/null; then
    echo "::error file=$production_values::Production Helm values do not render"
    missing=1
  fi
fi

if [[ "$missing" -ne 0 ]]; then
  echo "Production readiness checks failed."
  exit 1
fi

echo "Production readiness checks passed."
