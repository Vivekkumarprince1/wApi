#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REDIS_INSTANCE="${REDIS_INSTANCE:-wapi-redis}"
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"
REDIS_TIER="${REDIS_TIER:-basic}"
REDIS_VERSION="${REDIS_VERSION:-redis_7_2}"
NETWORK="${NETWORK:-default}"
SUBNET="${SUBNET:-default}"
VPC_EGRESS="${VPC_EGRESS:-private-ranges-only}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is not set and no gcloud project is configured." >&2
  exit 1
fi

SERVICES=(
  api-gateway
  auth-service
  contact-service
  chat-service
  billing-service
  campaign-service
  automation-service
  service-provider
  webhook-ingestor
  websocket-gateway
  admin-portal
)

echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Redis instance: ${REDIS_INSTANCE}"
echo "Network/subnet: ${NETWORK}/${SUBNET}"

echo "Enabling required APIs..."
gcloud services enable \
  redis.googleapis.com \
  run.googleapis.com \
  compute.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud redis instances describe "${REDIS_INSTANCE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" >/dev/null 2>&1; then
  echo "Creating Memorystore Redis instance ${REDIS_INSTANCE}..."
  gcloud redis instances create "${REDIS_INSTANCE}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --size="${REDIS_SIZE_GB}" \
    --tier="${REDIS_TIER}" \
    --redis-version="${REDIS_VERSION}" \
    --network="${NETWORK}"
else
  echo "Memorystore Redis instance already exists."
fi

echo "Waiting for Redis instance to become READY..."
for _ in {1..60}; do
  state="$(gcloud redis instances describe "${REDIS_INSTANCE}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(state)')"
  [[ "${state}" == "READY" ]] && break
  echo "Redis state: ${state:-unknown}; waiting 20s..."
  sleep 20
done

REDIS_HOST="$(gcloud redis instances describe "${REDIS_INSTANCE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(host)')"
REDIS_PORT="$(gcloud redis instances describe "${REDIS_INSTANCE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(port)')"

if [[ -z "${REDIS_HOST}" || -z "${REDIS_PORT}" ]]; then
  echo "Could not read Redis host/port." >&2
  exit 1
fi

REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"
echo "Redis URL: ${REDIS_URL}"

for service in "${SERVICES[@]}"; do
  if ! gcloud run services describe "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" >/dev/null 2>&1; then
    echo "Skipping ${service}; Cloud Run service does not exist."
    continue
  fi

  echo "Updating ${service}..."
  gcloud run services update "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --update-env-vars="REDIS_URL=${REDIS_URL}" \
    --network="${NETWORK}" \
    --subnet="${SUBNET}" \
    --vpc-egress="${VPC_EGRESS}" \
    --quiet
done

echo
echo "Done. Updated REDIS_URL for existing Cloud Run services."
echo "REDIS_URL=${REDIS_URL}"
