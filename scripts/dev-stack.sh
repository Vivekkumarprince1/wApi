#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

JWT_SECRET="${WAPI_JWT_SECRET:-local-dev-jwt-secret-change-me}"
INTERNAL_SERVICE_SECRET="${WAPI_INTERNAL_SERVICE_SECRET:-local-dev-internal-secret-change-me}"
REDIS_URL="${WAPI_REDIS_URL:-redis://localhost:6379}"

CORE_MONGODB_URI="${WAPI_CORE_MONGODB_URI:-mongodb://localhost:27017/wa_saas}"
BILLING_MONGODB_URI="${WAPI_BILLING_MONGODB_URI:-mongodb://localhost:27017/wapi_billing}"
CAMPAIGN_MONGODB_URI="${WAPI_CAMPAIGN_MONGODB_URI:-mongodb://localhost:27017/wa_campaigns}"
AUTOMATION_MONGODB_URI="${WAPI_AUTOMATION_MONGODB_URI:-mongodb://localhost:27017/wapi_automation}"

COMMON_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100"

pids=()

cleanup() {
  echo
  echo "[dev-stack] stopping ${#pids[@]} processes..."
  for pid in "${pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

require_port_free() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[dev-stack] port $port is already in use. Stop that process first."
    lsof -nP -iTCP:"$port" -sTCP:LISTEN
    exit 1
  fi
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[dev-stack] $name ready at $url"
      return 0
    fi
    sleep 1
  done

  echo "[dev-stack] $name did not become ready at $url"
  echo "[dev-stack] last log lines from $LOG_DIR/$name.log:"
  tail -n 80 "$LOG_DIR/$name.log" || true
  exit 1
}

start() {
  local name="$1"
  local dir="$2"
  shift 2

  echo "[dev-stack] starting $name"
  (
    cd "$ROOT/$dir"
    env "$@" npm run dev
  ) >"$LOG_DIR/$name.log" 2>&1 &
  pids+=("$!")
}

for port in 3000 3001 3002 3003 3004 3100 4000 5001; do
  require_port_free "$port"
done

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -u "$REDIS_URL" ping >/dev/null
  redis-cli -u "$REDIS_URL" CONFIG SET maxmemory-policy noeviction >/dev/null 2>&1 || true
fi

if command -v mongosh >/dev/null 2>&1; then
  mongosh "$CORE_MONGODB_URI" --quiet --eval "db.runCommand({ ping: 1 }).ok" >/dev/null
fi

start core-server services/core-server \
  NODE_ENV=development \
  PORT=3004 \
  BACKEND_PORT=3004 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  REDIS_URL="$REDIS_URL" \
  MONGODB_URI="$CORE_MONGODB_URI" \
  ALLOWED_ORIGINS="$COMMON_ORIGINS" \
  NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  AUTOMATION_SERVICE_URL=http://localhost:3001 \
  CAMPAIGN_SERVICE_URL=http://localhost:3002 \
  BILLING_SERVICE_URL=http://localhost:3003

start automation-service services/automation-service \
  NODE_ENV=development \
  PORT=3001 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  REDIS_URL="$REDIS_URL" \
  MONGODB_URI_AUTOMATION="$AUTOMATION_MONGODB_URI" \
  MONOLITH_URL=http://localhost:5001

start billing-service services/billing-service \
  NODE_ENV=development \
  PORT=3003 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  REDIS_URL="$REDIS_URL" \
  MONGODB_URI="$BILLING_MONGODB_URI" \
  MONOLITH_URL=http://localhost:5001

start campaign-service services/campaign-service \
  NODE_ENV=development \
  PORT=3002 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  REDIS_URL="$REDIS_URL" \
  MONGODB_URI_CAMPAIGN="$CAMPAIGN_MONGODB_URI" \
  MONOLITH_URL=http://localhost:5001 \
  BILLING_SERVICE_URL=http://localhost:3003

start websocket-service services/websocket-service \
  NODE_ENV=development \
  PORT=4000 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  REDIS_URL="$REDIS_URL" \
  CORE_SERVER_URL=http://localhost:3004 \
  ALLOWED_ORIGINS="$COMMON_ORIGINS"

start api-gateway services/api-gateway \
  NODE_ENV=development \
  PORT=5001 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  ALLOWED_ORIGINS="$COMMON_ORIGINS" \
  CORE_SERVER_URL=http://localhost:3004 \
  WEBSOCKET_SERVICE_URL=http://localhost:4000 \
  AUTOMATION_SERVICE_URL=http://localhost:3001 \
  CAMPAIGN_SERVICE_URL=http://localhost:3002 \
  BILLING_SERVICE_URL=http://localhost:3003

start customer-portal apps/customer-portal \
  NODE_ENV=development \
  PORT=3000 \
  NEXT_PUBLIC_APP_NAME=wApi \
  NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  NEXT_PUBLIC_API_URL=/api \
  NEXT_PUBLIC_SOCKET_URL=http://localhost:5001 \
  BACKEND_API_URL=http://localhost:5001

start admin-portal apps/admin-portal \
  NODE_ENV=development \
  PORT=3100 \
  NEXT_PUBLIC_APP_NAME="wApi Super Admin" \
  NEXT_PUBLIC_APP_URL=http://localhost:3100 \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_SERVICE_SECRET="$INTERNAL_SERVICE_SECRET" \
  ADMIN_COOKIE_NAME=admin_token \
  MONGODB_URI="$CORE_MONGODB_URI" \
  MONGODB_URI_BILLING="$BILLING_MONGODB_URI" \
  MONGODB_URI_CAMPAIGN="$CAMPAIGN_MONGODB_URI" \
  MONGODB_URI_AUTOMATION="$AUTOMATION_MONGODB_URI" \
  GATEWAY_URL=http://localhost:5001 \
  CUSTOMER_PORTAL_URL=http://localhost:3000

wait_for_url core-server http://localhost:3004/live
wait_for_url automation-service http://localhost:3001/live
wait_for_url billing-service http://localhost:3003/live
wait_for_url campaign-service http://localhost:3002/live
wait_for_url websocket-service http://localhost:4000/live
wait_for_url api-gateway http://localhost:5001/live
wait_for_url customer-portal http://localhost:3000
wait_for_url admin-portal http://localhost:3100/login

echo
echo "[dev-stack] all services are running"
echo "[dev-stack] customer portal: http://localhost:3000"
echo "[dev-stack] admin portal:    http://localhost:3100/login"
echo "[dev-stack] logs:            $LOG_DIR"
echo "[dev-stack] press Ctrl-C to stop everything"

wait
