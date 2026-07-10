# AKS GitOps Deployment

This repo is set up for:

Developer -> GitHub -> GitHub Actions -> tests/builds -> Docker images -> Azure Container Registry -> GitOps repo -> Argo CD -> AKS.

## GitHub configuration

Create these repository variables in the application repo:

- `ACR_NAME`: Azure Container Registry name without `.azurecr.io`.
- `AZURE_CLIENT_ID`: Azure federated credential client ID.
- `AZURE_TENANT_ID`: Azure tenant ID.
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID.
- `GITOPS_REPO`: GitOps repository in `owner/repo` format.
- `GITOPS_BRANCH`: optional, defaults to `main`.
- `GITOPS_ENV_DIR`: optional, defaults to `environments/production/connectsphere`.
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`: optional frontend build values.
- `BACKEND_API_URL`: optional frontend server-side API URL.

Create this repository secret:

- `GITOPS_TOKEN`: a token with write access to the GitOps repository.

## AKS configuration

Create the production secret in the target namespace before enabling Argo CD sync:

```bash
kubectl create namespace connectsphere
kubectl -n connectsphere create secret generic connectsphere-secrets \
  --from-literal=JWT_SECRET='replace-me' \
  --from-literal=INTERNAL_SERVICE_SECRET='replace-me' \
  --from-literal=INTEGRATION_ENCRYPTION_KEY='replace-me' \
  --from-literal=WEBHOOK_SECRET='replace-me' \
  --from-literal=VERIFY_TOKEN='replace-me' \
  --from-literal=MONGO_URI='replace-me' \
  --from-literal=MONGODB_URI='replace-me' \
  --from-literal=REDIS_URL='replace-me'
```

Replace the placeholders in `deploy/argocd/connectsphere-production.yaml`, then apply it to the cluster where Argo CD is installed:

```bash
kubectl apply -f deploy/argocd/connectsphere-production.yaml
```

The GitHub workflow copies `deploy/helm/connectsphere` into the GitOps environment directory and updates `global.image.registry` plus `global.image.tag` in `values.yaml`. Argo CD then syncs the new image tag into AKS.
