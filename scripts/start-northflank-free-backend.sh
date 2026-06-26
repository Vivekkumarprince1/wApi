#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-5001}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"

: "${MONGO_URI:?Set MONGO_URI to your Northflank MongoDB addon URI or an external MongoDB URI.}"
: "${JWT_SECRET:?Set JWT_SECRET.}"
: "${INTERNAL_SERVICE_SECRET:?Set INTERNAL_SERVICE_SECRET.}"

export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:?Set ALLOWED_ORIGINS to your public customer portal URL.}"
export AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://127.0.0.1:3006}"
export CONTACT_SERVICE_URL="${CONTACT_SERVICE_URL:-http://127.0.0.1:3007}"
export CHAT_SERVICE_URL="${CHAT_SERVICE_URL:-http://127.0.0.1:3008}"
export SERVICE_PROVIDER_URL="${SERVICE_PROVIDER_URL:-http://127.0.0.1:3004}"
export AUTOMATION_SERVICE_URL="${AUTOMATION_SERVICE_URL:-http://127.0.0.1:3001}"
export BILLING_SERVICE_URL="${BILLING_SERVICE_URL:-http://127.0.0.1:3003}"
export CAMPAIGN_SERVICE_URL="${CAMPAIGN_SERVICE_URL:-http://127.0.0.1:3002}"
export WEBSOCKET_URL="${WEBSOCKET_URL:-http://127.0.0.1:3009}"
export WEBHOOK_INGESTOR_URL="${WEBHOOK_INGESTOR_URL:-http://127.0.0.1:3013}"
export MAIN_SERVICE_URL="${MAIN_SERVICE_URL:-http://127.0.0.1:5001}"
export MONOLITH_URL="${MONOLITH_URL:-http://127.0.0.1:5001}"
export MONOLITH_INTERNAL_URL="${MONOLITH_INTERNAL_URL:-http://127.0.0.1:5001}"
export BSP_SERVICE_URL="${BSP_SERVICE_URL:-http://127.0.0.1:3004}"

pids=""

start_process() {
  name="$1"
  dir="$2"
  port="$3"
  mongo_uri="${4:-$MONGO_URI}"

  echo "[northflank-free] starting $name on port $port"
  (
    cd "$dir"
    PORT="$port" MONGO_URI="$mongo_uri" npm run start
  ) &
  pids="$pids $!"
}

shutdown() {
  echo "[northflank-free] shutting down"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  wait 2>/dev/null || true
}

trap shutdown INT TERM

redis-server --save "" --appendonly no --protected-mode no &
pids="$pids $!"

start_process "auth-service" "/app/services/auth-service" "3006" "${MONGO_URI_AUTH:-$MONGO_URI}"
start_process "contact-service" "/app/services/contact-service" "3007" "${MONGO_URI_CONTACT:-$MONGO_URI}"
start_process "chat-service" "/app/services/chat-service" "3008" "${MONGO_URI_CHAT:-$MONGO_URI}"
start_process "billing-service" "/app/services/billing-service" "3003" "${MONGO_URI_BILLING:-$MONGO_URI}"
start_process "campaign-service" "/app/services/campaign-service" "3002" "${MONGO_URI_CAMPAIGN:-$MONGO_URI}"
start_process "automation-service" "/app/services/automation-service" "3001" "${MONGO_URI_AUTOMATION:-$MONGO_URI}"
start_process "service-provider" "/app/services/service-provider" "3004" "${MONGO_URI_BSP:-$MONGO_URI}"
start_process "webhook-ingestor" "/app/services/webhook-ingestor" "3013" "${MONGO_URI_WEBHOOK:-$MONGO_URI}"
start_process "websocket-gateway" "/app/services/websocket-gateway" "3009" "${MONGO_URI_WEBSOCKET:-$MONGO_URI}"

# Start the public gateway last, after its local upstreams have begun booting.
start_process "api-gateway" "/app/services/api-gateway" "$PORT" "$MONGO_URI"

while true; do
  for pid in $pids; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[northflank-free] process $pid exited; stopping bundle"
      shutdown
      exit 1
    fi
  done
  sleep 5
done
