#!/usr/bin/env bash
set -euo pipefail

DOCKERHUB_USER="${DOCKERHUB_USER:-thevivek2003}"
PLATFORM="${PLATFORM:-linux/amd64}"
TAG="${TAG:-latest}"

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
)

for service in "${SERVICES[@]}"; do
  image="${DOCKERHUB_USER}/wapi-${service}:${TAG}"
  dockerfile="services/${service}/Dockerfile"

  echo "Building and pushing ${image} for ${PLATFORM}..."
  docker buildx build \
    --platform="${PLATFORM}" \
    -f "${dockerfile}" \
    -t "${image}" \
    --push \
    .
done

echo "Done."
