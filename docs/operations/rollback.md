# ConnectSphere v1.0 Rollback Strategy

## Application rollback

Images are tagged with immutable Git SHAs. Production GitOps values must reference one immutable SHA or release tag.

1. Stop the rollout if readiness, smoke, error-rate, queue-failure, or billing-integrity gates fail.
2. Revert the GitOps values commit to the previously verified image tag.
3. Allow Argo CD/Kubernetes rolling update to restore the previous ReplicaSet.
4. Verify readiness, API smoke tests, queue consumers, WebSocket connections, webhook acceptance, and billing duplicate protection.
5. Do not replay dead letters until application compatibility is confirmed.

`kubectl rollout undo` may be used for emergency recovery, but GitOps must immediately be reconciled to the same version to prevent Argo from redeploying the failed release.

## Database compatibility

v1.0 changes are additive:

- new fields have defaults or are optional;
- new indexes do not remove existing fields;
- new deletion and telemetry collections are additive;
- feature flags default off.

Old and new application versions can overlap during a rolling deployment.

### Rollback caveats

- Once a template has entered the new provider-backed lifecycle, older code that understands only `DRAFT/PENDING/APPROVED` may display newer states incorrectly. Data remains intact.
- Campaign messages with `RECONCILIATION_REQUIRED` must not be retried by pre-v0.9 workers.
- Deletion operations must continue under v1.0 workers or be paused before rollback; pre-v1.0 code does not understand the durable saga.
- Do not roll back to code that accepts mock provider success or unsigned production webhooks.

## Index rollout

Build large indexes before traffic migration where collection size makes startup auto-indexing unsafe. Use hidden indexes or staged creation where supported, monitor replication lag, then activate. Index removal is a separate later release, never part of the same rollout.

## Configuration rollback

Configuration and images are versioned together in GitOps. Never roll back secrets to known-compromised values. Secret schema must remain backward compatible for at least one release during rolling upgrades.

## Roll-forward preference

For provider lifecycle or financial data issues, prefer a forward patch over application rollback when the old version could misinterpret new durable states.
