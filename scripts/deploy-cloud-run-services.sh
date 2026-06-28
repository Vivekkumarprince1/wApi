#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-central1}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-512Mi}"
TIMEOUT="${TIMEOUT:-300}"
INGRESS="${INGRESS:-all}"
START_AT="${START_AT:-}"
SKIP_IMAGE_CHECKS="${SKIP_IMAGE_CHECKS:-false}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is not set and no gcloud project is configured." >&2
  exit 1
fi

SERVICE_NAMES=(
  auth-service
  contact-service
  chat-service
  billing-service
  campaign-service
  automation-service
  service-provider
  webhook-ingestor
  websocket-gateway
  api-gateway
)

SERVICE_IMAGES=(
  "thevivek2003/wapi-auth-service:latest"
  "thevivek2003/wapi-contact-service:latest"
  "thevivek2003/wapi-chat-service:latest"
  "thevivek2003/wapi-billing-service:latest"
  "thevivek2003/wapi-campaign-service:latest"
  "thevivek2003/wapi-automation-service:latest"
  "thevivek2003/wapi-service-provider:latest"
  "thevivek2003/wapi-webhook-ingestor:latest"
  "thevivek2003/wapi-websocket-gateway:latest"
  "thevivek2003/wapi-api-gateway:latest"
)

SERVICE_PORTS=(3006 3007 3008 3003 3002 3001 3004 3013 3009 5001)
SERVICE_ENV_FILES=(
  "services/auth-service/.env"
  "services/contact-service/.env"
  "services/chat-service/.env"
  "services/billing-service/.env"
  "services/campaign-service/.env"
  "services/automation-service/.env"
  "services/service-provider/.env"
  "services/webhook-ingestor/.env"
  "services/websocket-gateway/.env"
  "services/api-gateway/.env"
)

join_env_vars() {
  local env_file="$1"
  shift

  local env_keys=()
  local env_vals=()

  set_env() {
    local new_key="$1"
    local new_val="$2"
    [[ "${new_key}" == "PORT" ]] && return
    local idx
    for ((idx = 0; idx < ${#env_keys[@]}; idx++)); do
      if [[ "${env_keys[$idx]}" == "${new_key}" ]]; then
        env_vals[$idx]="${new_val}"
        return
      fi
    done
    env_keys+=("${new_key}")
    env_vals+=("${new_val}")
  }

  if [[ -f "${env_file}" ]]; then
    while IFS= read -r line || [[ -n "${line}" ]]; do
      [[ "${line}" =~ ^[[:space:]]*$ ]] && continue
      [[ "${line}" =~ ^[[:space:]]*# ]] && continue
      [[ "${line}" != *=* ]] && continue
      local key="${line%%=*}"
      local value="${line#*=}"
      key="$(printf '%s' "${key}" | xargs)"
      [[ -z "${key}" ]] && continue
      set_env "${key}" "${value}"
    done < "${env_file}"
  fi

  set_env "NODE_ENV" "production"
  set_env "NODE_OPTIONS" "--dns-result-order=ipv4first"
  [[ -n "${JWT_SECRET:-}" ]] && set_env "JWT_SECRET" "${JWT_SECRET}"
  [[ -n "${INTERNAL_SERVICE_SECRET:-}" ]] && set_env "INTERNAL_SERVICE_SECRET" "${INTERNAL_SERVICE_SECRET}"
  [[ -n "${INTEGRATION_ENCRYPTION_KEY:-}" ]] && set_env "INTEGRATION_ENCRYPTION_KEY" "${INTEGRATION_ENCRYPTION_KEY}"

  local pair
  for pair in "$@"; do
    [[ "${pair}" != *=* ]] && continue
    set_env "${pair%%=*}" "${pair#*=}"
  done

  local out="^|^"
  local idx
  for ((idx = 0; idx < ${#env_keys[@]}; idx++)); do
    out+="${env_keys[$idx]}=${env_vals[$idx]}|"
  done
  printf '%s' "${out%|}"
}

service_url() {
  gcloud run services describe "$1" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --platform=managed \
    --format='value(status.url)'
}

deploy_service() {
  local name="$1"
  local image="$2"
  local port="$3"
  local env_file="$4"
  shift 4
  local image_ref
  image_ref="$(resolve_amd64_image "${image}")"

  echo "Deploying ${name} from ${image_ref}..."
  gcloud run deploy "${name}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --platform=managed \
    --image="${image_ref}" \
    --port="${port}" \
    --allow-unauthenticated \
    --ingress="${INGRESS}" \
    --cpu="${CPU}" \
    --memory="${MEMORY}" \
    --timeout="${TIMEOUT}" \
    --min-instances="${MIN_INSTANCES}" \
    --max-instances="${MAX_INSTANCES}" \
    --set-env-vars="$(join_env_vars "${env_file}" "$@")" \
    --quiet
}

require_image() {
  local image="$1"
  if [[ -z "$(resolve_amd64_digest "${image}")" ]]; then
    echo "Docker Hub image does not expose a linux/amd64 manifest: ${image}" >&2
    exit 1
  fi
}

resolve_amd64_digest() {
  local image="$1"
  docker buildx imagetools inspect "${image}" --raw \
    | jq -r '.manifests[]? | select(.platform.os == "linux" and .platform.architecture == "amd64") | .digest' \
    | head -n 1
}

resolve_amd64_image() {
  local image="$1"
  local repository="${image%:*}"
  local digest
  digest="$(resolve_amd64_digest "${image}")"
  if [[ -z "${digest}" ]]; then
    echo "Docker Hub image does not expose a linux/amd64 manifest: ${image}" >&2
    exit 1
  fi
  printf 'docker.io/%s@%s' "${repository}" "${digest}"
}

echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
if [[ "${SKIP_IMAGE_CHECKS}" == "true" ]]; then
  echo "Skipping Docker Hub image preflight checks."
else
  echo "Checking Docker Hub images for linux/amd64 manifests..."
  for image in "${SERVICE_IMAGES[@]}"; do
    require_image "${image}"
  done
fi

echo "Deploying base service revisions..."
started=false
[[ -z "${START_AT}" ]] && started=true
for i in "${!SERVICE_NAMES[@]}"; do
  if [[ "${SERVICE_NAMES[$i]}" == "api-gateway" ]]; then
    continue
  fi
  if [[ "${SERVICE_NAMES[$i]}" == "${START_AT}" ]]; then
    started=true
  fi
  if [[ "${started}" != "true" ]]; then
    echo "Skipping ${SERVICE_NAMES[$i]} before START_AT=${START_AT}."
    continue
  fi
  deploy_service \
    "${SERVICE_NAMES[$i]}" \
    "${SERVICE_IMAGES[$i]}" \
    "${SERVICE_PORTS[$i]}" \
    "${SERVICE_ENV_FILES[$i]}"
done

AUTH_SERVICE_URL="$(service_url auth-service)"
CONTACT_SERVICE_URL="$(service_url contact-service)"
CHAT_SERVICE_URL="$(service_url chat-service)"
BILLING_SERVICE_URL="$(service_url billing-service)"
CAMPAIGN_SERVICE_URL="$(service_url campaign-service)"
AUTOMATION_SERVICE_URL="$(service_url automation-service)"
SERVICE_PROVIDER_URL="$(service_url service-provider)"
WEBHOOK_INGESTOR_URL="$(service_url webhook-ingestor)"
WEBSOCKET_URL="$(service_url websocket-gateway)"

echo "Deploying api-gateway with Cloud Run service URLs..."
deploy_service \
  "api-gateway" \
  "thevivek2003/wapi-api-gateway:latest" \
  "5001" \
  "services/api-gateway/.env" \
  "AUTH_SERVICE_URL=${AUTH_SERVICE_URL}" \
  "CONTACT_SERVICE_URL=${CONTACT_SERVICE_URL}" \
  "CHAT_SERVICE_URL=${CHAT_SERVICE_URL}" \
  "SERVICE_PROVIDER_URL=${SERVICE_PROVIDER_URL}" \
  "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}" \
  "AUTOMATION_SERVICE_URL=${AUTOMATION_SERVICE_URL}" \
  "BILLING_SERVICE_URL=${BILLING_SERVICE_URL}" \
  "CAMPAIGN_SERVICE_URL=${CAMPAIGN_SERVICE_URL}" \
  "WEBSOCKET_URL=${WEBSOCKET_URL}" \
  "WEBHOOK_INGESTOR_URL=${WEBHOOK_INGESTOR_URL}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}"

API_GATEWAY_URL="$(service_url api-gateway)"

echo "Updating services with final dependency URLs..."
deploy_service "chat-service" "thevivek2003/wapi-chat-service:latest" "3008" "services/chat-service/.env" \
  "CONTACT_SERVICE_URL=${CONTACT_SERVICE_URL}" \
  "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}" \
  "BILLING_SERVICE_URL=${BILLING_SERVICE_URL}" \
  "AUTOMATION_SERVICE_URL=${AUTOMATION_SERVICE_URL}"
deploy_service "billing-service" "thevivek2003/wapi-billing-service:latest" "3003" "services/billing-service/.env" \
  "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}"
deploy_service "campaign-service" "thevivek2003/wapi-campaign-service:latest" "3002" "services/campaign-service/.env" \
  "BILLING_SERVICE_URL=${BILLING_SERVICE_URL}" \
  "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}" \
  "CHAT_SERVICE_URL=${CHAT_SERVICE_URL}" \
  "CONTACT_SERVICE_URL=${CONTACT_SERVICE_URL}" \
  "API_GATEWAY_URL=${API_GATEWAY_URL}" \
  "MONOLITH_URL=${API_GATEWAY_URL}"
deploy_service "automation-service" "thevivek2003/wapi-automation-service:latest" "3001" "services/automation-service/.env" \
  "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}" \
  "CHAT_SERVICE_URL=${CHAT_SERVICE_URL}" \
  "MONOLITH_INTERNAL_URL=${API_GATEWAY_URL}"
deploy_service "service-provider" "thevivek2003/wapi-service-provider:latest" "3004" "services/service-provider/.env" \
  "MAIN_SERVICE_URL=${API_GATEWAY_URL}" \
  "CAMPAIGN_SERVICE_URL=${CAMPAIGN_SERVICE_URL}" \
  "BILLING_SERVICE_URL=${BILLING_SERVICE_URL}"

cat <<EOF

Cloud Run services:
api-gateway:       ${API_GATEWAY_URL}
auth-service:      ${AUTH_SERVICE_URL}
contact-service:   ${CONTACT_SERVICE_URL}
chat-service:      ${CHAT_SERVICE_URL}
billing-service:   ${BILLING_SERVICE_URL}
campaign-service:  ${CAMPAIGN_SERVICE_URL}
automation-service:${AUTOMATION_SERVICE_URL}
service-provider:  ${SERVICE_PROVIDER_URL}
webhook-ingestor:  ${WEBHOOK_INGESTOR_URL}
websocket-gateway: ${WEBSOCKET_URL}
EOF
