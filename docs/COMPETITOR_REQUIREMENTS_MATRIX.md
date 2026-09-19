# Nomad FR pressure test: MemoryLake and Supermemory

**Research date:** 16 September 2026. This is a public-source comparison, not a hands-on product test. A capability not described on a page is **unknown**, not absent. Vendor descriptions are claims from [MemoryLake](https://www.memorylake.ai/) and [Supermemory](https://supermemory.ai/product/).

| Nomad requirement | MemoryLake public claim | Supermemory public claim | Nomad's proposed testable requirement |
|---|---|---|---|
| FR-1 Identity and tenancy | Enterprise security positioning; detailed tenant/admin semantics not verified in inspected source | Organizations, roles, scoped keys, and user/project/tenant isolation via containers | Prove cross-tenant denial and the same person having separate personal, employer, project, and client authorities. No uniqueness claim yet. |
| FR-2 Passport management | Direct "Memory Passport" claim, typed/versioned data, per-AI visibility, export/deletion, provenance, conflict history | Cross-model memory, shared spaces, inference review, editing/forgetting | Field record must include owner, source, verification state, sensitivity, purpose, scope, expiry, and version; show a person exactly what would be released. This is a specification, not a proven gap. |
| FR-3 Policy and authorization | Per-AI visibility claimed; public page did not demonstrate per-request purpose/project/operation decisions or employee-versus-org intersection | Roles and scoped keys claimed; public page did not demonstrate employee-controlled per-field grants intersected with enterprise rules | Evaluate every read/write against authenticated tenant, user, client, field, operation, declared purpose, project/client, and expiry; show which rule limited it. Validate by hands-on trial. |
| FR-4 Proposal and consent | Conflict strategies and version history claimed; exact old/new approval UX not verified | Inference review claimed; employer-policy intersection not verified | Model writes are proposals. Employee sees old/new values, source, scope, expiry, and effects before approval; company-owned data respects owner authority. Measure completion and consent fatigue. |
| FR-5 Evidence and audit | Access logs, immutable audit-log and export claims | Request logs claimed | One decision ID joins employee-readable access history and administrator evidence; include policy version, field IDs, actor, result, and redacted reason. Independently test tamper-evidence. |
| FR-6 Integration gateway | Platform-neutral cross-AI positioning; exact target-client mechanics require trial | MCP and OAuth MCP, plugins/API claimed | Demonstrate Claude plus ChatGPT calling the gateway under different policies; no claim of direct writes to vendors' private native memories. |
| FR-7 Data lifecycle | Export/deletion and version history claimed | Forgetting and user/project scope claimed | Define retention, review, export, deletion authority and **future-access revocation**. Do not promise to retract data already disclosed to an AI vendor. |

## What would establish real differentiation

1. Obtain trial access to both products and run identical field-release, correction, and revocation scenarios. Record screenshots, API behavior, policy precedence, and latency.
2. Interview at least one employee, IT owner, and privacy/security owner at each design partner. Confirm that the proposed dual-control workflow is valuable rather than extra friction.
3. Demonstrate two supported assistants receiving different fields for different purposes under the same passport, with the employee and auditor able to explain the same decision.
4. If either competitor supports this equally well, narrow Nomad's wedge to an unmet buyer workflow or stop making differentiation claims.
