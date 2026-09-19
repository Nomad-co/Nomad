# Independent security review scope

Give this document, `CREDENTIALS_AND_TRUST_BOUNDARY.md`, the current source revision, deployment diagram, and a temporary staging account to an assessor who did not implement the system.

## Required tests

1. OAuth authorization-code and PKCE flows, redirect validation, token audience/scope enforcement, session fixation, logout, grant revocation, and dynamic client registration abuse.
2. Cross-user and future cross-tenant access across every D1 query, R2 key, KV session, MCP tool, export, audit record, and error path.
3. CSRF, XSS, injection, prompt injection, malicious PDF/text ingestion, oversized input, content-type confusion, and denial of service.
4. Sealed-field exclusion, sensitive proposal approval, stale-write conflicts, permission downgrade, connector kill switch, and account deletion completeness.
5. Secret exposure in source, repository history, logs, traces, analytics, exports, backups, browser storage, errors, and support workflows.
6. Cloudflare configuration, least-privilege deployment credentials, environment isolation, dependency risk, backup restoration, alert delivery, and rollback.
7. Evidence-event immutability and integrity chaining after the enterprise ledger is implemented.

## Acceptance

- No open critical or high finding.
- Medium findings have an owner, due date, and documented compensating control.
- Retest evidence references the exact release candidate.
- The assessor states scope limits and excluded components.
- Nomad records the report location and approval in the release record without committing confidential report content.
