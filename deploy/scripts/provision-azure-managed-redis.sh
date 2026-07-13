#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-connectsphere-prod-rg}"
AKS_NAME="${AKS_NAME:-connectsphere-prod-aks}"
NAMESPACE="${NAMESPACE:-connectsphere}"
KEYVAULT_NAME="${KEYVAULT_NAME:-connectsphere-prod-kv}"
K8S_SECRET_NAME="${K8S_SECRET_NAME:-connectsphere-secrets}"
LOCATION="${LOCATION:-eastus}"
REDIS_SKU="${REDIS_SKU:-Balanced_B0}"
REDIS_NAME="${REDIS_NAME:-}"
TEST_POD="connectsphere-redis-connectivity-test"
TEST_SECRET="connectsphere-redis-connectivity-test"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need az
need kubectl
need node

subscription_id="$(az account show --query id -o tsv)"
if [ -z "$REDIS_NAME" ]; then
  REDIS_NAME="connectsphere-prod-redis-${subscription_id:0:8}"
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  kubectl -n "$NAMESPACE" delete pod "$TEST_POD" --ignore-not-found >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" delete secret "$TEST_SECRET" --ignore-not-found >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

echo "Using Azure subscription: ${subscription_id}"
echo "Managed Redis resource: ${RESOURCE_GROUP}/${REDIS_NAME}"

echo "Refreshing AKS credentials..."
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --overwrite-existing \
  -o none

echo "Ensuring Microsoft.Cache is registered..."
az provider register --namespace Microsoft.Cache --wait

echo "Ensuring Azure Managed Redis exists..."
if ! az redisenterprise show \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --query id -o tsv >/dev/null 2>&1; then
  az redisenterprise create \
    --resource-group "$RESOURCE_GROUP" \
    --cluster-name "$REDIS_NAME" \
    --location "$LOCATION" \
    --sku "$REDIS_SKU" \
    --high-availability Enabled \
    --access-keys-authentication Enabled \
    --client-protocol Encrypted \
    --minimum-tls-version 1.2 \
    --clustering-policy EnterpriseCluster \
    --eviction-policy AllKeysLRU \
    --public-network-access Enabled \
    --tags environment=production application=connectsphere managed-by=cli \
    --no-wait \
    -o none
fi

echo "Waiting for Azure Managed Redis provisioning (this can take up to one hour)..."
az redisenterprise wait \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --created \
  --interval 30 \
  --timeout 3600

redis_host="$(az redisenterprise show \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --query hostName -o tsv)"
redis_port="$(az redisenterprise database show \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --query port -o tsv)"
redis_port="${redis_port:-10000}"
redis_key="$(az redisenterprise database list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --query primaryKey -o tsv)"

if [ -z "$redis_host" ] || [ -z "$redis_key" ]; then
  echo "Managed Redis did not return a hostname or access key." >&2
  exit 1
fi

echo "Testing Azure control-plane connectivity..."
az redisenterprise test-connection \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$REDIS_NAME" \
  --auth access-key \
  -o none

echo "Testing DNS, TLS, and authentication from AKS..."
kubectl -n "$NAMESPACE" delete pod "$TEST_POD" --ignore-not-found >/dev/null
kubectl -n "$NAMESPACE" delete secret "$TEST_SECRET" --ignore-not-found >/dev/null
kubectl -n "$NAMESPACE" create secret generic "$TEST_SECRET" \
  --from-literal=REDIS_HOST="$redis_host" \
  --from-literal=REDIS_PORT="$redis_port" \
  --from-literal=REDIS_KEY="$redis_key" >/dev/null

kubectl -n "$NAMESPACE" apply -f - >/dev/null <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${TEST_POD}
spec:
  restartPolicy: Never
  containers:
    - name: redis-cli
      image: redis:7-alpine
      envFrom:
        - secretRef:
            name: ${TEST_SECRET}
      command: ["sh", "-c"]
      args:
        - >-
          result=\$(redis-cli -h "\$REDIS_HOST" -p "\$REDIS_PORT" --tls
          --sni "\$REDIS_HOST" -a "\$REDIS_KEY" --no-auth-warning ping) &&
          test "\$result" = "PONG"
YAML

test_phase=""
for _ in $(seq 1 90); do
  test_phase="$(kubectl -n "$NAMESPACE" get pod "$TEST_POD" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  if [ "$test_phase" = "Succeeded" ] || [ "$test_phase" = "Failed" ]; then
    break
  fi
  sleep 2
done

if [ "$test_phase" != "Succeeded" ]; then
  echo "AKS Redis connectivity test failed. Production was not changed." >&2
  kubectl -n "$NAMESPACE" logs "$TEST_POD" --tail=100 >&2 || true
  exit 1
fi

echo "AKS Redis connectivity test passed."

encoded_key="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$redis_key")"
redis_url="rediss://:${encoded_key}@${redis_host}:${redis_port}"
printf '%s' "$redis_url" > "$tmp_dir/redis-url"
chmod 600 "$tmp_dir/redis-url"

echo "Updating Azure Key Vault secret: redis-url"
az keyvault secret set \
  --vault-name "$KEYVAULT_NAME" \
  --name redis-url \
  --file "$tmp_dir/redis-url" \
  --output none

echo "Updating only REDIS_URL in the synchronized Kubernetes Secret..."
redis_b64="$(printf '%s' "$redis_url" | base64 | tr -d '\n')"
kubectl -n "$NAMESPACE" patch secret "$K8S_SECRET_NAME" \
  --type merge \
  -p "{\"data\":{\"REDIS_URL\":\"${redis_b64}\"}}" >/dev/null

deployments=(
  connectsphere-api-gateway
  connectsphere-auth-service
  connectsphere-automation-service
  connectsphere-billing-service
  connectsphere-campaign-service
  connectsphere-chat-service
  connectsphere-service-provider
  connectsphere-websocket-gateway
)

echo "Restarting Redis-dependent deployments..."
kubectl -n "$NAMESPACE" rollout restart "${deployments[@]/#/deployment/}" >/dev/null

for deployment in "${deployments[@]}"; do
  kubectl -n "$NAMESPACE" rollout status "deployment/${deployment}" --timeout=10m
done

echo "Verifying workload health..."
kubectl -n "$NAMESPACE" get pods

echo
echo "Azure Managed Redis is active."
echo "Resource: ${REDIS_NAME}"
echo "Host: ${redis_host}"
echo "Port: ${redis_port}"
echo "Key Vault secret: ${KEYVAULT_NAME}/redis-url"
echo "The access key and REDIS_URL were not printed."
