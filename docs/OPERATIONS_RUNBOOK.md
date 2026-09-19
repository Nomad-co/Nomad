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

### 2026-09-19 staging data restore

The staging data restore completed at `2026-09-19T21:09:56Z` in temporary, isolated Cloudflare resources that were deleted after verification.

- Cloudflare's native D1 export could not export this schema because it contains FTS5 virtual tables. The drill used a logical export of the 11 authoritative tables and rebuilt the derived FTS index during restore.
- The source and restored logical exports matched exactly. Both had SHA-256 `5843e669b6af22d4c44f30c12abb54b41113c6df7d0a0f0e1d972a61b92e7dfc`.
- Record counts matched: `users=1`; `clients`, `fields`, `field_versions`, `proposals`, `audit`, `files`, `file_chunks`, `threads`, `usage_events`, and `evaluation_runs` were all `0`.
- The source contained no file records, so the corresponding R2 manifest had zero objects. The isolated recovery bucket was created empty.
- The recovery KV namespace was created empty and remained empty, confirming that browser sessions and OAuth grants were not restored.
- Measured command times were 2.28 seconds for the logical export, approximately 3.22 seconds for migrations, and 3.70 seconds for the database restore.
- No public recovery Worker was deployed because the restored database contained a staging user record. Application-read validation remains required in a private recovery environment.

This evidence validates the data restoration procedure for the captured staging dataset. It does not establish a production RTO or RPO, and the full application recovery drill remains open until application reads and a non-empty R2 restore are tested privately.
