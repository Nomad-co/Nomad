# Enterprise design-partner pilot runbook

## Entry requirements

- Signed pilot owner, security owner, privacy owner, support contact, and incident contact.
- Company-managed identity provider and exact ChatGPT/Claude workspace plans identified.
- Test-data classification, retention period, deletion process, and success metrics approved.
- Staging smoke, restore drill, alert test, and independent security review passed.
- Tenant isolation, roles, organization policies, evidence integrity, and connector kill switch implemented and tested.

## Pilot shape

- One organization, 10–20 invited users, two approved assistant clients, and seven consecutive days.
- Use synthetic or explicitly approved low-risk data first.
- Limit evaluation to two prompts per milestone: one normal path and one denial/revocation path.
- Record tool-call success, p50/p95 Nomad request latency, authorization failures, proposal decision time, support requests, sealed-data leaks, recovery events, and user-reported trust.

## Exit evidence

- Zero cross-tenant or sealed-data disclosure.
- Every consequential action has the same decision identifier in employee and administrator evidence views.
- Revocation and connector kill switch stop new access within the agreed objective.
- Export and deletion complete and are independently checked.
- Reliability objectives are calculated from pilot measurements.
- Customer security and product owners sign the pilot result before any expansion.

## Stop conditions

Stop access immediately for suspected unauthorized disclosure, tenant-boundary failure, broken revocation, missing evidence, lost credentials, or an uncontained availability event. Preserve content-minimized evidence, rotate affected credentials, notify the named incident owner, and resume only after documented approval.
