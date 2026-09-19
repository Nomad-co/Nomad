# Nomad Implementation Plan

This plan is organized by evidence gates rather than calendar weeks. The goal is to build the smallest trustworthy product that can survive an enterprise pilot.

## What has been completed

| Area | Status | Evidence |
|---|---|---|
| Original PRD review | Complete | Contradictions, security gaps, and unsupported claims identified |
| Market and competitor review | Public-source refresh complete; hands-on comparison pending | `docs/COMPETITIVE_RESEARCH_2026-09.md` and `docs/COMPETITOR_REQUIREMENTS_MATRIX.md` |
| Vendor capability validation | Partial | Personal and public-documentation paths checked; company-managed connector behavior needs live validation. Google's Gemini custom apps currently exclude work/school accounts. |
| Product positioning | Enterprise-first confirmed by the user | Build for a company buyer and managed employee use; personal subscription tests are only connector feasibility evidence |
| Personas | Complete | Buyer, champion, control, and daily-user personas |
| M1 connector feasibility | In progress | Real stateless MCP diagnostic Worker in `apps/mcp-worker`; live assistant calls pending |
| Design direction | Awaiting selection | Three new light concepts in `docs/UI_DIRECTIONS.md`; old dark/green prototype is historical only |
| PRD v2.0 | Historical baseline | `docs/Nomad_PRD_v2.0.md` and PDF |
| PRD v2.1 | Draft complete; user review pending | `docs/Nomad_PRD_v2.1.md` and PDF |
| Credential architecture | Proposed, not implemented | `docs/CREDENTIALS_AND_TRUST_BOUNDARY.md` |

## Section 1 - Product contracts

Build first because every screen, API, policy, and audit event depends on shared language.

Deliverables:

- ContextPassport, ContextField, AccessGrant, ContextProposal, PolicyDecision, EvidenceEvent
- Scope hierarchy: personal, organization, project, client
- Sensitivity and purpose taxonomies
- Lifecycle and conflict state machines
- OpenAPI and MCP tool contracts

Exit evidence:

- Example payloads reviewed against five real user scenarios
- No field can be read or changed without a policy decision
- Every mutation is idempotent and evidence-linked
- Effective access is demonstrated as organization ceiling intersected with the employee's narrower grant
- Each context field has an owner and authority rule; no ambiguous employee-versus-employer control

## Section 2 - Trust foundation

Deliverables:

- Organization and user tenancy
- Authentication and role model
- Deny-by-default authorization service
- Database migrations and encryption boundary
- Proposal quarantine
- Append-only evidence ledger
- Negative authorization and tenant-isolation tests

Exit evidence:

- Cross-tenant access tests fail closed
- Revoked grants stop working immediately
- LLM output cannot bypass policy enforcement
- Backup, restore, and deletion behavior demonstrated
- No provider password or model API key is required for clients to use Nomad context
- Secret handling and negative security tests in `docs/CREDENTIALS_AND_TRUST_BOUNDARY.md` pass

## Section 3 - Employee product

Deliverables:

- Home and context-health view
- Passport browsing and editing
- Tool access matrix
- Approval inbox
- Activity and evidence timeline
- Export, expiration, revocation, and deletion flows

Exit evidence:

- Employee can answer what each connected tool can see
- Employee can approve, edit, deny, and revoke within the organization's maximum policy without administrator assistance
- Critical flows pass keyboard and screen-reader checks

## Section 4 - MCP integration

Deliverables:

- `context.search` read tool
- `context.render` purpose-specific context bundle
- `context.propose` untrusted write proposal
- `context.proposal_status` decision lookup
- OAuth 2.1 authorization and audience validation
- Generic MCP conformance harness
- Claude and ChatGPT connection guides

Exit evidence:

- Two AI clients receive different context under different policies
- A prohibited field never appears in tool output or logs
- Sensitive proposals require approval and cannot self-approve

## Section 5 - Enterprise administration

Deliverables:

- Organization overview
- Policy builder and simulator
- People, groups, and roles
- Connector registration and kill switch
- Evidence investigation and export
- Retention and deletion administration
- SSO and provisioning

Exit evidence:

- Administrator can introduce a policy safely using simulation
- Auditor can reconstruct an access decision without seeing unnecessary plaintext
- Connector credentials can be rotated or disabled without redeployment

## Section 6 - Pilot operations

Deliverables:

- Production deployment pipeline
- Environment and secret management
- Monitoring, alerting, backup, and restoration
- Incident and privacy request runbooks
- Pilot onboarding and support process
- Success measurement dashboard

Exit evidence:

- Restore and connector-revocation drills completed
- Design partner agrees on baseline, success criteria, and exit conditions
- Security, privacy, and accessibility reviews have no unresolved critical findings
- A staging deployment has passed migration, rollback, backup restore, observability, and secret-rotation checks

## Section 7 - Controlled deployment and expansion

Do not treat a successful demo as a production launch. Deploy a staging environment first, then a tenant-isolated design-partner pilot, then production only after measured reliability and external security review.

1. Choose the deployment target and identity provider with the design partner; document data residency and key ownership.
2. Establish infrastructure as code, CI checks, migrations, secret injection, and a rollback path.
3. Deploy staging with synthetic data and exercise the full request, approval, revocation, export, and deletion flows.
4. Complete threat modeling, penetration testing, privacy review, accessibility testing, restore drill, and incident-response drill.
5. Admit one pilot tenant and two approved AI clients, with feature flags and a connector kill switch.
6. Measure repeated-context reduction, decision clarity, unauthorized-read attempts, revocation delay, incident rate, and user trust.
7. Review pilot evidence with the customer. Fix gaps before expanding tenants or calling the product generally available.

## Recommended production architecture - decision pending

Do not lock the stack from the prototype. The production architecture should be selected after domain-contract approval. The current recommendation is:

- Web application and API organized as a modular monolith
- PostgreSQL as the system of record
- Database-backed job processing until measured load requires a broker
- Remote MCP endpoint and REST API at the same trust boundary
- External identity provider for enterprise SSO
- Managed key service for envelope encryption
- Object storage only for exports and evidence checkpoints

The recommendation intentionally avoids microservices, a dedicated vector database, and a separate event platform until pilot evidence requires them. Personal-account Claude, ChatGPT, and Gemini connection tests are not substitutes for company-managed account and administrator-policy tests.

## Immediate next decision

Confirm whether the first company pilot will use company-managed Claude Team/Enterprise and ChatGPT Work/Enterprise workspaces. That answer determines the connector validation and administrator approval path; personal subscriptions alone cannot establish enterprise compatibility. Until those workspaces are available, the product can be developed as pilot-ready but not described as enterprise-validated.

Then select the new light interface direction and the first workflow to validate:

- **A - Calm Passport:** employee-owned context and access clarity.
- **B - Decision Inbox:** field-level approval, correction, and denial.
- **C - Policy Studio:** enterprise dual-control governance and evidence.

The chosen direction is not permission to invent an industry, cloud provider, pricing model, or legal ownership rule. Those decisions need discovery and explicit approval before production implementation.
