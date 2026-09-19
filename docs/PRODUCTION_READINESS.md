# Nomad production readiness

Updated: 19 September 2026

The deployed Worker is a personal pilot. It must not be represented as enterprise production until every release gate below is complete. Passing unit tests or a successful connector demo does not satisfy a human, contractual, or independent-review gate.

## Seven production foundations

| # | Foundation | Current evidence | Exit condition |
|---|---|---|---|
| 1 | Publish Google OAuth | Public privacy and pilot terms pages exist; OAuth works for test users | Owned production domain verified, consent screen branding reviewed, production callback registered, Google publishing or verification complete |
| 2 | Production domain and branding | Worker has a stable `workers.dev` pilot URL and `nomad.service.support@gmail.com` as the support contact | Owned domain, DNS, custom Worker route, privacy owner, and final branding approved |
| 3 | Source control and CI | `Nomad-co/Nomad` contains the full source; CI passes; `main` requires both app checks and one approval; staging and production environments exist; Sai approves production | Add a dedicated scoped Cloudflare API token to both GitHub environments and complete one staging workflow dispatch |
| 4 | Cloudflare alerts | In-product usage guardrails and read-only degradation exist | Billing, Worker error, D1, KV, and R2 notifications route to two accountable operators and a test notification is acknowledged |
| 5 | Staging | Isolated D1, KV, R2, Worker hostname, migrations, and smoke check are live | A separate Google OAuth client and staging secrets are configured; authenticated connector smoke passes |
| 6 | Independent security review | Review scope and trust-boundary documents exist | External reviewer closes all critical/high findings and accepted residual risks have named owners and dates |
| 7 | Field validation | Personal ChatGPT and Claude connector checks passed | One design-partner organization completes the pilot runbook with two approved assistants and signed exit evidence |

## Enterprise product gates

The seven foundations above do not supply the enterprise features required by `Nomad_PRD_v2.1.md`. Before admitting company data, Nomad also needs:

- Organization tenancy with strict tenant-bound queries and encryption context.
- Employee, reviewer, administrator, auditor, and service-client roles.
- Enterprise SSO, user provisioning, and group synchronization.
- Deny-by-default operation authorization where effective permission is the intersection of organization policy, data-owner authority, and the employee's narrower choice.
- Append-only evidence events with integrity chaining and externally anchored checkpoints.
- Tenant retention, expiration, export, deletion, and legal-hold rules.
- An organization-wide connector kill switch and incident response ownership.

These features require a design partner's identity provider, managed ChatGPT/Claude workspace types, ownership rules, retention policy, and hosting constraints. The architecture decision remains open; the personal D1 schema must not be renamed into a multi-tenant product without those inputs.

## Release rule

Production promotion requires one release record containing: CI run, migration result, smoke result, backup checkpoint, security approval, pilot approval, rollback owner, and deployed release identifier. If any item is absent, keep the service in pilot status.
