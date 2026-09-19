# Nomad operations runbook

## Deployment

1. Require a green CI run and reviewed release revision.
2. Export or checkpoint production data according to the approved retention policy.
3. Apply migrations to staging, deploy staging, and run `NOMAD_ORIGIN=https://... EXPECTED_ENVIRONMENT=staging node scripts/smoke.mjs`.
4. Obtain the production environment approval, apply production migrations, deploy, and run the same smoke check with `EXPECTED_ENVIRONMENT=production`.
5. Record the Worker version, migration set, operator, time, and rollback owner.

## Alert minimums

Configure Cloudflare notifications for billing usage, Worker errors, and relevant D1, KV, and R2 limits. Send alerts to two operators. Trigger and acknowledge a test alert before the pilot.

## Incident response

1. Disable affected connectors or set `READ_ONLY_MODE=true` when writes are unsafe.
2. Revoke exposed Cloudflare, Google, session, and MCP credentials.
3. Preserve content-minimized logs and record UTC times, affected tenants/users, release, and containment actions.
4. Notify the named security/privacy owners under the pilot agreement.
5. Restore from a verified checkpoint into staging and run smoke, isolation, authorization, export, and deletion checks before production recovery.

## Restore drill

At least once before the enterprise pilot, restore a D1 export and the corresponding R2 objects into isolated staging. Verify record counts, file hashes, OAuth/session revocation behavior, and application reads. Record recovery time and recovery point; do not claim an RTO or RPO until this drill supplies measured values.
