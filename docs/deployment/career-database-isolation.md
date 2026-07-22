# Career portal database isolation

The career portal is a self-contained Next.js application. Its Better Auth
handlers, Prisma schema, recruitment APIs, and candidate data use a dedicated
MongoDB database and dedicated authentication secrets.

## Ownership boundary

- Runtime: `apps/career-portal`
- Database: `career`
- MongoDB secret: `career-mongodb-uri`
- Better Auth secret: `career-better-auth-secret`
- Google OAuth secrets: `career-google-client-id` and
  `career-google-client-secret`
- Kubernetes environment keys: `CAREER_MONGODB_URI`,
  `CAREER_BETTER_AUTH_SECRET`, `CAREER_GOOGLE_CLIENT_ID`, and
  `CAREER_GOOGLE_CLIENT_SECRET`

The platform `auth-service` continues to use `MONGO_URI_AUTH`, `JWT_SECRET`, and
its own provider configuration. The career portal must not use those values.

## Migration

`scripts/production/migrate-career-database.sh` derives the collection allowlist
from the career Prisma schema. It copies mapped collections, including their
BSON types and indexes. This is appropriate only when the source database is
already career-owned. If career and platform documents share a collection such
as `users`, first create an approved record-level ownership plan; do not apply a
whole-collection migration because it would copy unified identities.

Run a dry run first:

```text
SOURCE_MONGODB_URI=... CAREER_MONGODB_URI=... \
  scripts/production/migrate-career-database.sh
```

Apply after reviewing the source, target, and collection count:

```text
SOURCE_MONGODB_URI=... CAREER_MONGODB_URI=... \
  scripts/production/migrate-career-database.sh --apply
```

Never place connection strings in source control or command output. Load them
from Azure Key Vault or another approved secret store.

Before applying, confirm that the target Atlas cluster has enough collection
capacity for the collections being migrated. On capacity-constrained shared
clusters, initialize only required collections and allow MongoDB to create
feature collections when the corresponding career feature is first used. A
logical database on the same cluster provides data isolation, not capacity
isolation.

## Rollback

The migration does not modify the source database. To roll back, restore the
previous career `secretEnv` mappings in GitOps and synchronize Argo CD. Sessions
created after the cutover are intentionally invalid because the dedicated
Better Auth secret establishes a new career-only trust boundary.
