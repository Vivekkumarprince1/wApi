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
  --from-literal=BETTER_AUTH_SECRET='replace-with-at-least-32-random-characters' \
  --from-literal=REDIS_URL='replace-me'
```

### Portal Google OAuth and career Key Vault values

Before enabling the portals, create these secrets in `connectsphere-prod-kv`:

| Key Vault object | Career portal environment variable |
|---|---|
| `better-auth-secret` | `BETTER_AUTH_SECRET` |
| `google-client-id` | `GOOGLE_CLIENT_ID` |
| `google-client-secret` | `GOOGLE_CLIENT_SECRET` |
| `smtp-host` | `SMTP_HOST` |
| `smtp-user` | `SMTP_USER` |
| `smtp-password` | `SMTP_PASSWORD` |
| `email-reply-to` | `EMAIL_REPLY_TO` |
| `career-contract-encryption-key` | `CONTRACT_ENCRYPTION_KEY` |
| `career-webhook-encryption-key` | `WEBHOOK_ENCRYPTION_KEY` |
| `career-recaptcha-secret-key` | `RECAPTCHA_SECRET_KEY` |
| `career-observability-http-endpoint` | `OBSERVABILITY_HTTP_ENDPOINT` |
| `career-observability-http-token` | `OBSERVABILITY_HTTP_TOKEN` |
| `career-metrics-token` | `METRICS_TOKEN` |
| `career-malware-scan-url` | `MALWARE_SCAN_URL` |
| `career-malware-scan-token` | `MALWARE_SCAN_TOKEN` |
| `career-rate-limit-rest-url` | `RATE_LIMIT_REST_URL` |
| `career-rate-limit-rest-token` | `RATE_LIMIT_REST_TOKEN` |

The career portal reuses the existing `mongodb-uri` and Cloudinary Key Vault objects. Google login is shared by all portals through the same Key Vault client credentials. Set the GitHub repository variable `GOOGLE_AUTH_ENABLED` to `true`, then register these authorized redirect URIs for the Google OAuth client: `https://connectsphere-career-vivek.eastus.cloudapp.azure.com/api/auth/callback/google`, `https://connectsphere-customer-vivek.eastus.cloudapp.azure.com/auth/google/callback`, and `https://connectsphere-admin-vivek.eastus.cloudapp.azure.com/auth/google/callback`. Google sign-in for the admin portal permits existing platform-admin accounts only; it never provisions an admin role. The browser-visible reCAPTCHA site key must be configured as the GitHub repository variable `CAREER_RECAPTCHA_SITE_KEY`; it is compiled into the client bundle and is not a secret.

Replace the placeholders in `deploy/argocd/connectsphere-production.yaml`, then apply it to the cluster where Argo CD is installed:

```bash
kubectl apply -f deploy/argocd/connectsphere-production.yaml
```

The GitHub workflow copies `deploy/helm/connectsphere` into the GitOps environment directory and updates `global.image.registry` plus `global.image.tag` in `production-values.yaml`. Argo CD then syncs the new image tag into AKS.
