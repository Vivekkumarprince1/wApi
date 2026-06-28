#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-central1}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REPOSITORY="${REPOSITORY:-wapi-repo}"
TAG="${TAG:-latest}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-512Mi}"
TIMEOUT="${TIMEOUT:-300}"
INGRESS="${INGRESS:-all}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is not set and no gcloud project is configured." >&2
  exit 1
fi

image_ref() {
  printf '%s-docker.pkg.dev/%s/%s/%s:%s' "${REGION}" "${PROJECT_ID}" "${REPOSITORY}" "$1" "${TAG}"
}

service_url() {
  gcloud run services describe "$1" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --platform=managed \
    --format='value(status.url)' 2>/dev/null || true
}

project_url_for() {
  local service="$1"
  local known
  known="$(service_url "${service}")"
  if [[ -n "${known}" ]]; then
    printf '%s' "${known}"
    return
  fi

  local gateway_url suffix
  gateway_url="$(service_url api-gateway)"
  if [[ "${gateway_url}" =~ ^https://api-gateway-(.+)$ ]]; then
    suffix="${BASH_REMATCH[1]}"
    printf 'https://%s-%s' "${service}" "${suffix}"
  fi
}

dotenv_value() {
  local env_file="$1"
  local key="$2"
  if [[ ! -f "${env_file}" ]]; then
    return
  fi
  awk -F= -v key="${key}" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' "${env_file}"
}

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

build_image() {
  local name="$1"
  local dockerfile="$2"
  shift 2

  local image
  image="$(image_ref "${name}")"

  yaml_quote() {
    local value="$1"
    value="${value//\'/\'\'}"
    printf "'%s'" "${value}"
  }

  local config_file
  config_file="$(mktemp)"
  trap 'rm -f "${config_file}"' RETURN

  {
    echo "steps:"
    echo "  - name: gcr.io/cloud-builders/docker"
    echo "    args:"
    echo "      - build"
    echo "      - --platform=linux/amd64"
    echo "      - -f"
    printf "      - %s\n" "$(yaml_quote "${dockerfile}")"
    echo "      - -t"
    printf "      - %s\n" "$(yaml_quote "${image}")"

    local pair
    for pair in "$@"; do
      echo "      - --build-arg"
      printf "      - %s\n" "$(yaml_quote "${pair}")"
    done

    echo "      - ."
    echo "images:"
    printf "  - %s\n" "$(yaml_quote "${image}")"
  } > "${config_file}"

  echo "Building ${image}..."
  gcloud builds submit . \
    --project="${PROJECT_ID}" \
    --config="${config_file}"
}

deploy_service() {
  local service="$1"
  local image="$2"
  local port="$3"
  local env_vars="$4"

  echo "Deploying ${service}..."
  gcloud run deploy "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --platform=managed \
    --image="${image}" \
    --port="${port}" \
    --allow-unauthenticated \
    --ingress="${INGRESS}" \
    --cpu="${CPU}" \
    --memory="${MEMORY}" \
    --timeout="${TIMEOUT}" \
    --min-instances="${MIN_INSTANCES}" \
    --max-instances="${MAX_INSTANCES}" \
    --set-env-vars="${env_vars}" \
    --quiet
}

API_GATEWAY_URL="$(service_url api-gateway)"
AUTH_SERVICE_URL="$(service_url auth-service)"
CONTACT_SERVICE_URL="$(service_url contact-service)"
CHAT_SERVICE_URL="$(service_url chat-service)"
BILLING_SERVICE_URL="$(service_url billing-service)"
CAMPAIGN_SERVICE_URL="$(service_url campaign-service)"
AUTOMATION_SERVICE_URL="$(service_url automation-service)"
SERVICE_PROVIDER_URL="$(service_url service-provider)"
WEBHOOK_INGESTOR_URL="$(service_url webhook-ingestor)"
WEBSOCKET_URL="$(service_url websocket-gateway)"

if [[ -z "${API_GATEWAY_URL}" || -z "${WEBSOCKET_URL}" ]]; then
  echo "api-gateway and websocket-gateway must be deployed before the portals." >&2
  exit 1
fi

CUSTOMER_URL="${CUSTOMER_URL:-$(project_url_for customer-portal)}"
ADMIN_URL="${ADMIN_URL:-$(project_url_for admin-portal)}"

GOOGLE_CLIENT_ID="$(dotenv_value apps/customer-portal/.env.local NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
FACEBOOK_APP_ID="$(dotenv_value apps/customer-portal/.env.local NEXT_PUBLIC_FACEBOOK_APP_ID)"
BUSINESS_VERIFICATION_MANDATORY="$(dotenv_value apps/customer-portal/.env.local NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY)"
BUSINESS_VERIFICATION_MANDATORY="${BUSINESS_VERIFICATION_MANDATORY:-false}"

CUSTOMER_IMAGE="$(image_ref wapi-customer-portal)"
ADMIN_IMAGE="$(image_ref wapi-admin-portal)"

build_image "wapi-customer-portal" "apps/customer-portal/Dockerfile" \
  "NEXT_PUBLIC_APP_NAME=ConnectSphare" \
  "NEXT_PUBLIC_APP_URL=${CUSTOMER_URL}" \
  "NEXT_PUBLIC_API_URL=/api" \
  "NEXT_PUBLIC_SOCKET_URL=${WEBSOCKET_URL}" \
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  "NEXT_PUBLIC_FACEBOOK_APP_ID=${FACEBOOK_APP_ID}" \
  "NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY=${BUSINESS_VERIFICATION_MANDATORY}" \
  "BACKEND_API_URL=${API_GATEWAY_URL}" \
  "ALLOWED_DEV_ORIGINS=${CUSTOMER_URL}"

deploy_service "customer-portal" "${CUSTOMER_IMAGE}" "3000" \
  "$(join_env_vars apps/customer-portal/.env.local \
    "NEXT_PUBLIC_APP_URL=${CUSTOMER_URL}" \
    "NEXT_PUBLIC_API_URL=/api" \
    "NEXT_PUBLIC_SOCKET_URL=${WEBSOCKET_URL}" \
    "BACKEND_API_URL=${API_GATEWAY_URL}" \
    "ALLOWED_DEV_ORIGINS=${CUSTOMER_URL}")"

CUSTOMER_URL="$(service_url customer-portal)"
ADMIN_URL="${ADMIN_URL:-$(project_url_for admin-portal)}"

build_image "wapi-admin-portal" "apps/admin-portal/Dockerfile" \
  "NEXT_PUBLIC_APP_NAME=wApi Super Admin" \
  "NEXT_PUBLIC_APP_URL=${ADMIN_URL}"

deploy_service "admin-portal" "${ADMIN_IMAGE}" "3100" \
  "$(join_env_vars apps/admin-portal/.env.local \
    "NEXT_PUBLIC_APP_URL=${ADMIN_URL}" \
    "GATEWAY_URL=${API_GATEWAY_URL}" \
    "CUSTOMER_PORTAL_URL=${CUSTOMER_URL}" \
    "API_GATEWAY_URL=${API_GATEWAY_URL}" \
    "AUTH_SERVICE_URL=${AUTH_SERVICE_URL}" \
    "CONTACT_SERVICE_URL=${CONTACT_SERVICE_URL}" \
    "CHAT_SERVICE_URL=${CHAT_SERVICE_URL}" \
    "BILLING_SERVICE_URL=${BILLING_SERVICE_URL}" \
    "CAMPAIGN_SERVICE_URL=${CAMPAIGN_SERVICE_URL}" \
    "AUTOMATION_SERVICE_URL=${AUTOMATION_SERVICE_URL}" \
    "SERVICE_PROVIDER_URL=${SERVICE_PROVIDER_URL}" \
    "BSP_SERVICE_URL=${SERVICE_PROVIDER_URL}" \
    "WEBHOOK_INGESTOR_URL=${WEBHOOK_INGESTOR_URL}" \
    "WEBSOCKET_URL=${WEBSOCKET_URL}")"

ADMIN_URL="$(service_url admin-portal)"

cat <<EOF

Cloud Run frontends:
customer-portal: ${CUSTOMER_URL}
admin-portal:    ${ADMIN_URL}
EOF
