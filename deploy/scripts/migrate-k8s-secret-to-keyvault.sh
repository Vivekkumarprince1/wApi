#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-connectsphere-prod-rg}"
AKS_NAME="${AKS_NAME:-connectsphere-prod-aks}"
NAMESPACE="${NAMESPACE:-connectsphere}"
K8S_SECRET_NAME="${K8S_SECRET_NAME:-connectsphere-secrets}"
KEYVAULT_NAME="${KEYVAULT_NAME:-connectsphere-prod-kv}"
LOCATION="${LOCATION:-eastus}"
SPC_NAME="${SPC_NAME:-connectsphere-keyvault-secrets}"
SYNC_DEPLOYMENT="${SYNC_DEPLOYMENT:-connectsphere-secret-sync}"
TEST_SECRET_NAME="${TEST_SECRET_NAME:-connectsphere-secrets-kv-test}"
TEST_SPC_NAME="${TEST_SPC_NAME:-connectsphere-keyvault-secrets-test}"
TEST_DEPLOYMENT="${TEST_DEPLOYMENT:-connectsphere-secret-sync-test}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need az
need kubectl
need node

echo "Checking Azure account..."
subscription_id="$(az account show --query id -o tsv)"
tenant_id="$(az account show --query tenantId -o tsv)"

echo "Refreshing AKS kubeconfig for ${RESOURCE_GROUP}/${AKS_NAME}..."
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --overwrite-existing \
  -o none

echo "Reading current Kubernetes secret: ${NAMESPACE}/${K8S_SECRET_NAME}"
kubectl -n "$NAMESPACE" get secret "$K8S_SECRET_NAME" -o json > "$tmp_dir/current-secret.json"

node -e '
const fs = require("fs");
const path = require("path");
const tmpDir = process.argv[1];
const secret = JSON.parse(fs.readFileSync(path.join(tmpDir, "current-secret.json"), "utf8"));
const data = secret.data || {};
const keys = Object.keys(data).sort();
if (!keys.length) {
  console.error("Source Kubernetes secret has no data keys.");
  process.exit(1);
}
const used = new Map();
const objects = keys.map((key) => {
  let objectName = key.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!objectName) objectName = "secret";
  const count = used.get(objectName) || 0;
  used.set(objectName, count + 1);
  if (count > 0) objectName = `${objectName}-${count + 1}`;
  const valuePath = path.join(tmpDir, `${objectName}.value`);
  fs.writeFileSync(valuePath, Buffer.from(data[key], "base64"));
  return { key, objectName, valuePath };
});
fs.writeFileSync(path.join(tmpDir, "objects.json"), JSON.stringify(objects, null, 2));
console.log(`Found ${objects.length} secret keys.`);
' "$tmp_dir"

echo "Ensuring Key Vault exists: ${KEYVAULT_NAME}"
if ! az keyvault show --name "$KEYVAULT_NAME" --query id -o tsv >/dev/null 2>&1; then
  az keyvault create \
    --name "$KEYVAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --enable-rbac-authorization true \
    --query id \
    -o tsv >/dev/null
fi
keyvault_id="$(az keyvault show --name "$KEYVAULT_NAME" --query id -o tsv)"

echo "Ensuring AKS Secrets Store CSI Driver add-on is enabled..."
az aks enable-addons \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --addons azure-keyvault-secrets-provider \
  -o none

identity_client_id="$(az aks show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --query addonProfiles.azureKeyvaultSecretsProvider.identity.clientId \
  -o tsv)"
identity_object_id="$(az ad sp show --id "$identity_client_id" --query id -o tsv)"

echo "Granting current user write access to Key Vault when possible..."
current_user_object_id="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"
if [ -n "$current_user_object_id" ]; then
  if ! az role assignment list --assignee "$current_user_object_id" --scope "$keyvault_id" --role "Key Vault Secrets Officer" --query '[0].id' -o tsv | grep -q .; then
    az role assignment create --assignee-object-id "$current_user_object_id" --assignee-principal-type User --role "Key Vault Secrets Officer" --scope "$keyvault_id" -o none
  fi
fi

echo "Granting AKS CSI identity read access to Key Vault..."
if ! az role assignment list --assignee "$identity_object_id" --scope "$keyvault_id" --role "Key Vault Secrets User" --query '[0].id' -o tsv | grep -q .; then
  az role assignment create --assignee-object-id "$identity_object_id" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope "$keyvault_id" -o none
fi

echo "Uploading current Kubernetes secret values to Key Vault. Values will not be printed."
node -e "const fs=require('fs'); for (const o of JSON.parse(fs.readFileSync('$tmp_dir/objects.json','utf8'))) console.log([o.objectName,o.valuePath].join('\\t'));" |
while IFS=$'\t' read -r object_name value_path; do
  az keyvault secret set --vault-name "$KEYVAULT_NAME" --name "$object_name" --file "$value_path" --query id -o tsv >/dev/null
done

make_manifest() {
  local spc_name="$1"
  local secret_name="$2"
  local deployment_name="$3"
  local output_path="$4"

  node - "$tmp_dir/objects.json" "$spc_name" "$secret_name" "$deployment_name" "$KEYVAULT_NAME" "$tenant_id" "$identity_client_id" > "$output_path" <<'NODE'
const fs = require("fs");
const [objectsPath, spcName, secretName, deploymentName, keyVaultName, tenantId, identityClientId] = process.argv.slice(2);
const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));
const secretData = objects.map((o) => `        - objectName: "${o.objectName}"\n          key: "${o.key}"`).join("\n");
const objectArray = objects.map((o) => `        - |\n          objectName: ${o.objectName}\n          objectType: secret`).join("\n");
console.log(`apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: ${spcName}
spec:
  provider: "azure"
  secretObjects:
    - secretName: ${secretName}
      type: "Opaque"
      data:
${secretData}
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: "${identityClientId}"
    keyvaultName: "${keyVaultName}"
    tenantId: "${tenantId}"
    objects: |
      array:
${objectArray}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deploymentName}
  labels:
    app.kubernetes.io/name: connectsphere
    app.kubernetes.io/instance: connectsphere
    app.kubernetes.io/component: ${deploymentName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: connectsphere
      app.kubernetes.io/instance: connectsphere
      app.kubernetes.io/component: ${deploymentName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: connectsphere
        app.kubernetes.io/instance: connectsphere
        app.kubernetes.io/component: ${deploymentName}
    spec:
      containers:
        - name: sync
          image: registry.k8s.io/pause:3.10
          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true
      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true
            volumeAttributes:
              secretProviderClass: "${spcName}"
`);
NODE
}

compare_secret_data() {
  node -e '
const fs = require("fs");
const expected = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).data || {};
const actual = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).data || {};
const expectedKeys = Object.keys(expected).sort();
const actualKeys = Object.keys(actual).sort();
const mismatched = expectedKeys.filter((key) => expected[key] !== actual[key]);
if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys) || mismatched.length) {
  console.error("Secret data mismatch. Live secret was not switched.");
  console.error("Expected keys:", expectedKeys.join(","));
  console.error("Actual keys:", actualKeys.join(","));
  if (mismatched.length) console.error("Mismatched keys:", mismatched.join(","));
  process.exit(1);
}
console.log(`Verified ${expectedKeys.length} secret keys match exactly.`);
' "$1" "$2"
}

echo "Creating temporary Key Vault-backed secret for verification: ${TEST_SECRET_NAME}"
make_manifest "$TEST_SPC_NAME" "$TEST_SECRET_NAME" "$TEST_DEPLOYMENT" "$tmp_dir/test-sync.yaml"
kubectl -n "$NAMESPACE" apply -f "$tmp_dir/test-sync.yaml"
kubectl -n "$NAMESPACE" rollout status "deployment/${TEST_DEPLOYMENT}" --timeout=180s

echo "Waiting for temporary synced secret..."
for _ in $(seq 1 30); do
  if kubectl -n "$NAMESPACE" get secret "$TEST_SECRET_NAME" -o json > "$tmp_dir/test-secret.json" 2>/dev/null; then
    break
  fi
  sleep 5
done
kubectl -n "$NAMESPACE" get secret "$TEST_SECRET_NAME" -o json > "$tmp_dir/test-secret.json"
compare_secret_data "$tmp_dir/current-secret.json" "$tmp_dir/test-secret.json"

echo "Activating Key Vault sync for live Kubernetes secret: ${K8S_SECRET_NAME}"
make_manifest "$SPC_NAME" "$K8S_SECRET_NAME" "$SYNC_DEPLOYMENT" "$tmp_dir/live-sync.yaml"
kubectl -n "$NAMESPACE" apply -f "$tmp_dir/live-sync.yaml"
kubectl -n "$NAMESPACE" rollout status "deployment/${SYNC_DEPLOYMENT}" --timeout=180s

kubectl -n "$NAMESPACE" get secret "$K8S_SECRET_NAME" -o json > "$tmp_dir/live-secret.json"
compare_secret_data "$tmp_dir/current-secret.json" "$tmp_dir/live-secret.json"

echo "Removing temporary verification resources..."
kubectl -n "$NAMESPACE" delete deployment "$TEST_DEPLOYMENT" --ignore-not-found
kubectl -n "$NAMESPACE" delete secretproviderclass "$TEST_SPC_NAME" --ignore-not-found
kubectl -n "$NAMESPACE" delete secret "$TEST_SECRET_NAME" --ignore-not-found

echo "Checking deployments remain available..."
kubectl -n "$NAMESPACE" get deploy -o wide

echo
echo "Key Vault is active for ${NAMESPACE}/${K8S_SECRET_NAME}."
echo "Key Vault: ${KEYVAULT_NAME}"
echo "SecretProviderClass: ${SPC_NAME}"
echo "AKS CSI identity clientId: ${identity_client_id}"
echo
echo "Use this GitOps values block:"
echo "keyVaultSecrets:"
echo "  enabled: true"
echo "  keyVaultName: ${KEYVAULT_NAME}"
echo "  tenantId: ${tenant_id}"
echo "  userAssignedIdentityID: ${identity_client_id}"
echo "  objects:"
node -e "const fs=require('fs'); for (const o of JSON.parse(fs.readFileSync('$tmp_dir/objects.json','utf8'))) console.log(\`    - key: \${o.key}\\n      objectName: \${o.objectName}\`);"
