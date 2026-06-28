# GitHub Actions Cloud Run Deployment

This repo has an auto-deploy workflow at `.github/workflows/deploy-cloud-run.yml`.

When code is pushed to `main` under `apps/**`, `services/**`, `packages/contracts/**`, or the workflow file, GitHub Actions builds each service/portal as a `linux/amd64` Docker image, pushes it to Docker Hub and Google Artifact Registry, then updates the matching Google Cloud Run service from Artifact Registry.

## Required GitHub Secrets

Add these in GitHub repo settings:

```text
DOCKERHUB_USERNAME=thevivek2003
DOCKERHUB_TOKEN=<Docker Hub access token>
```

Optional repo variable:

```text
DOCKERHUB_NAMESPACE=thevivek2003
```

If the variable is not set, the workflow uses `thevivek2003`.

## Google Setup Already Used

Google Cloud is configured to use Workload Identity Federation, so GitHub Actions does not need a long-lived Google JSON key.

Configured values:

```text
WIF_PROVIDER=projects/527014678364/locations/global/workloadIdentityPools/github-actions/providers/github
WIF_SERVICE_ACCOUNT=github-cloud-run-deployer@wapi-backend-56102.iam.gserviceaccount.com
```

The deploy service account has:

```text
roles/run.admin
roles/iam.serviceAccountUser
roles/artifactregistry.writer
```

If you ever need to recreate it, use:

```bash
PROJECT_ID=wapi-backend-56102
PROJECT_NUMBER=527014678364
REPO=Vivekkumarprince1/wApi
SA_NAME=github-cloud-run-deployer
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID=github-actions
PROVIDER_ID=github

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  --project="${PROJECT_ID}"

gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Cloud Run deployer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --condition=None

gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${REPO}'"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  --condition=None
```

## Manual Deploy

In GitHub, open Actions, choose `Deploy to Cloud Run`, and run it manually.

Use:

```text
all
```

or one service/portal name, for example:

```text
api-gateway
customer-portal
admin-portal
```

## Notes

- Cloud Run environment variables, Redis/VPC settings, ingress, memory, CPU, and min/max instance settings are preserved because the workflow only updates the container image.
- Frontend public values are needed at Next.js build time. The workflow reads the current Cloud Run service URLs and public env values, passes them as Docker build args, then updates the same Cloud Run service image.
- Docker Hub still receives images, but Cloud Run deploys from Artifact Registry to avoid Docker Hub mirror/import delays.
