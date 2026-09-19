# Nomad Product Requirements Document

**Version:** 2.1  
**Status:** Market and security revision; M1 connection test in progress; PDF export predates wording corrections  
**Product category:** Enterprise AI Context Control Plane  
**Builds on:** Nomad PRD v2.0; original concept in v1.0

## 1. Executive summary

Nomad gives organizations and their employees one governed place to control which approved context each AI assistant may read, propose, update, retain, and export.

The product is not another general-purpose AI memory database. It is a context-release workflow that sits between people, organizations, and AI tools. Nomad stores typed context passports, evaluates access against deterministic organization and individual controls, captures user approval where required, and shows a clear access-history entry for each consequential read or write.

The first commercial wedge is an enterprise using more than one AI assistant and needing consistent employee context without unrestricted sharing between vendors, projects, or clients. This is a hypothesis to test with design partners, not an established market moat.

## 2. Product decision

### Previous framing

The original concept positioned Nomad as a universal, portable memory layer shared across AI products.

### Updated framing

Portable memory and agent governance are both active, increasingly crowded categories. Nomad cannot credibly claim that storage, portability, provenance, audit logs, or governance in general are unique. Its candidate wedge is the *employee-facing release decision* inside an enterprise policy boundary:

> Nomad makes portable AI context usable across approved tools, while making each consequential release, correction, and revocation understandable to the person and provable to the organization.

Connectivity is provided through standards such as MCP and vendor tool APIs. The claim to test is whether a field-level, purpose-bound decision flow that joins organization limits, individual choice, and portable evidence solves a high-value workflow better than existing memory or governance products. It is not a claim that no competitor can or does offer any of these components.

### 2.1 Named competitive landscape (16 September 2026)

The categories overlap. The table records what vendors **publicly claim** in their own product material; it does not independently validate implementation quality or assert that an unmentioned capability is absent.

| Product | Publicly claimed overlap | Nomad implication |
|---|---|---|
| MemoryLake | A "Memory Passport," per-AI visibility, provenance, version/conflict history, access logs, and audit export | Direct positioning overlap. Nomad must prove a better employee/enterprise joint decision workflow, not claim the passport idea is new. |
| Supermemory | Cross-model memory through MCP, OAuth, shared spaces, roles, scoped keys, and request logs | Cross-tool memory and governance primitives already exist. Test field-level purpose and project decisions hands on. |
| Mem0 OpenMemory and Zep | MCP memory with project/visibility controls and logs; Zep also claims authorization, retention, provenance, and audit at the data layer | "Storage versus governance" is too simple a market split. Define the exact authorization and consent semantics. |
| Kiteworks Compliant AI and MintMCP | Agent/data gateways with operation or tool controls, revocation, and audit | Enterprise policy and audit are established categories. Nomad's employee-facing context correction/release flow needs validation. |
| MemSync, MemOS, Atlan | Consumer cross-app control, model-agnostic memory lifecycle, or enterprise context-layer positioning respectively | Both consumer portability and enterprise context are contested. Avoid broad "universal" claims. |

The full first-party source map and unknowns are in `docs/COMPETITIVE_RESEARCH_2026-09.md`; a requirement-by-requirement MemoryLake/Supermemory comparison is in `docs/COMPETITOR_REQUIREMENTS_MATRIX.md`. AI Context Flow was named in the brief, but its exact first-party product source was not verified in this pass. The supplied funding, API-volume, and 22-vendor-guide numbers are excluded until attributable evidence is found.

### 2.2 Testable differentiation, not an exclusivity claim

Nomad's product hypothesis is the combination of: (1) an employee-readable, per-field request and access-history entry; (2) purpose, project/client, operation, and expiry bound to each request; (3) effective access that intersects organization maximum policy and data-owner authority with the person's narrower choice; (4) proposed writes separated from trusted context; and (5) the same decision identifier available in the employee activity view and administrator evidence export. The first pilot must demonstrate the complete flow across two approved assistants and compare it against MemoryLake and Supermemory trials. If those products already deliver it comparably, Nomad must narrow or change its wedge.

## 3. Problem

Enterprises increasingly operate a multi-vendor AI stack. Employees repeat preferences, project facts, terminology, constraints, and working conventions in each tool. Copying that context manually is inefficient, but sharing it automatically creates security and privacy risk.

Organizations lack a consistent answer to five questions:

1. What context about an employee, project, or client exists?
2. Who owns it and where did it come from?
3. Which AI tool may use it, for what purpose, and for how long?
4. Who approved a change or disclosure?
5. Can the organization prove, revoke, export, or delete that access?

Vendor-native memory settings answer only a portion of these questions and do so separately inside each vendor boundary.

## 4. Target users and buyers

### Economic buyer

**VP of Enterprise AI / CIO delegate** - accountable for adoption, cost, governance, and measurable value across a multi-vendor AI portfolio.

### Technical champion

**Staff AI Platform Engineer** - integrates approved tools and needs a reliable, standards-based context service without building separate policy logic for every assistant.

### Control stakeholders

- **CISO / Security Architect** - needs least privilege, tenant isolation, revocation, and incident evidence.
- **Data Protection Officer / Privacy Counsel** - needs purpose limitation, retention, subject access, deletion, and defensible consent records.
- **Identity / SaaS Administrator** - needs SSO, provisioning, role management, and organization-wide connector controls.

### Daily users

- **Knowledge worker** - wants useful personalization without repeatedly explaining preferences and projects.
- **Consultant or client-services professional** - needs hard separation between client contexts.
- **Internal AI application developer** - needs a stable context contract and clear authorization responses.

## 5. User needs

### Employee

- When I use an approved AI assistant, give it only the context appropriate to my current organization, project, and task.
- Let me see, correct, expire, export, or revoke context associated with me.
- Ask me before a tool stores sensitive or materially new context.

### Enterprise administrator

- Define which tools can access which context classes and purposes.
- Enforce boundaries between personal, organization, project, and client context.
- Investigate reads, proposed changes, approvals, denials, exports, and revocations.
- Apply retention and deletion policy consistently across integrations.

### AI platform engineer

- Integrate once through MCP or REST instead of rebuilding memory governance for every agent.
- Receive deterministic authorization results and stable schemas.
- Separate model-generated proposals from committed context.

## 6. Product principles

1. **Context is governed data, not chat history.** Full transcripts are not stored by default.
2. **The user can see what the AI sees.** Rendered context is inspectable before and after access.
3. **Models propose; policy decides.** An LLM never grants itself access or commits sensitive context.
4. **Least privilege by field, purpose, scope, and time.** Broad permanent grants are not the default.
5. **Work and personal identities remain separate.** No silent movement across tenant or client boundaries.
6. **Every consequential action leaves evidence.** Reads, writes, approvals, denials, exports, and revocations are recorded.
7. **Open interfaces, portable data.** Customers can export their context and integrate through documented protocols.
8. **Useful without surveillance.** The product must not become an employee-monitoring system.

## 7. Product model

### 7.1 Context passport

A passport is a scoped collection of typed context fields. A person may have multiple passports.

Initial passport scopes:

- Personal
- Organization
- Project
- Client

Initial field families:

- Communication preferences
- Working conventions
- Role and responsibility
- Project facts and terminology
- Decisions and constraints
- Relationships and stakeholders
- Accessibility preferences
- Custom organization-defined fields

Every field includes:

- Identifier and schema version
- Human-readable value
- Owner and subject
- Scope and organization
- Source and provenance
- Sensitivity classification
- Allowed purposes
- Allowed tools or tool classes
- Created, reviewed, and expiration timestamps
- Confidence and verification state
- Version and supersession relationship

### 7.2 Access grant

An access grant permits a specific client to perform a defined operation on an allowed field set for a documented purpose and duration. For employee-controlled fields, effective access is the intersection of organization policy, applicable data-owner authority, and the employee's narrower choice. An employee may withhold or revoke access within that ceiling but cannot authorize a release that the organization or client-data owner forbids. Conversely, an administrator cannot silently turn an employee-private field into a shared work field. Employment-record and legal-hold exceptions require explicit legal review and visible product rules.

### 7.3 Context proposal

AI tools do not directly write trusted context. They submit proposals containing the candidate value, source, evidence, purpose, and requested scope. Policy either denies, auto-approves low-risk changes, or routes the proposal for human approval.

### 7.4 Policy

Policies are deterministic rules evaluated outside the model. They may reference tenant, user role, tool, operation, context scope, sensitivity, purpose, project, client, geography, and time.

### 7.5 Evidence event

Each read, proposal, approval, denial, change, export, revocation, or deletion creates an append-only evidence event. The event records the actor, client, policy decision, affected field identifiers, purpose, result, and integrity linkage. Sensitive values are not duplicated into the event stream.

## 8. User experience and information architecture

### 8.1 Employee workspace

**Home** - context health, connected tools, pending approvals, recent activity, and expiring grants. The first-screen emphasis is still awaiting selection among the three light concepts.

**My Passport** - inspect and edit context by scope and category; view provenance, visibility, and expiration.

**Access** - see which AI tools can read or propose changes to each context class; revoke or narrow access.

**Approvals** - review proposed context changes and sensitive access requests with plain-language consequences.

**Activity** - searchable evidence timeline showing which tool accessed what, why, and under which policy.

**Connections** - connect or disconnect supported AI tools and view their capabilities.

### 8.2 Enterprise administrator workspace

**Overview** - adoption, integration health, policy coverage, risk exceptions, and unresolved approvals.

**Policies** - create and test context access rules using structured conditions rather than free-form prompts.

**People and groups** - provision users, assign roles, and apply group policies.

**Integrations** - approve connectors, configure OAuth clients, rotate credentials, and disable capabilities.

**Evidence** - investigate access events and export audit evidence.

**Data lifecycle** - retention, expiration, deletion, export, and legal-hold controls.

### 8.3 Light interface directions awaiting selection

- **A - Calm Passport:** employee context and access at a glance; warm white with clay accents.
- **B - Decision Inbox:** review exactly what a tool wants to read or save; cool white with blue accents.
- **C - Policy Studio:** organization ceiling, individual choice, and evidence; white/mist with violet accents.

All three are static sample-data mockups in `docs/UI_DIRECTIONS.md`. The earlier dark/green clickable prototype is superseded as a visual direction. No production UI is being built before selection.

### 8.4 Primary interaction flow

1. An employee or administrator connects an approved AI tool.
2. The tool requests relevant context for a declared purpose and scope.
3. Nomad authenticates the client and evaluates policy.
4. Nomad returns only allowed fields in a purpose-specific rendering.
5. The tool may submit a proposed context update.
6. Nomad validates and classifies the proposal.
7. Low-risk proposals follow policy; sensitive proposals enter the approval inbox.
8. The final decision and resulting change create linked evidence events.
9. The employee or administrator can later revoke access, expire data, or export evidence.

## 9. Functional requirements

### FR-1 Identity and tenancy

- Organization and user tenancy
- Strict tenant-bound queries and encryption context
- Role-based access for employee, reviewer, administrator, auditor, and service client
- Enterprise SSO before production pilot
- Provisioning and group sync before broad rollout

### FR-2 Passport management

- Create, read, edit, archive, export, and delete passports
- Typed and versioned context fields
- Provenance, sensitivity, purpose, review state, and expiration metadata
- Optimistic concurrency and visible conflict handling
- No silent overwrite of verified context

### FR-3 Policy and authorization

- Deny by default
- Per-operation authorization for every request
- Field-, scope-, purpose-, tool-, project-, and time-aware decisions
- Explainable allow, deny, and approval-required results
- Effective permission computed from organization ceiling, data-owner authority, and employee choice; no actor can exceed the ceiling
- Policy simulation before activation
- Emergency connector revocation

### FR-4 Proposal and consent workflow

- Tools submit proposals rather than trusted writes
- Plain-language review showing old value, proposed value, source, and consequence
- Approve once, approve rule, edit and approve, or deny
- Sensitive categories always require explicit review unless an administrator has established a lawful alternative workflow
- Approval decisions are reversible where technically possible
- An access-history entry shows tool, field identifiers, purpose, scope, duration, decision, policy basis, and revocation path in employee-readable language
- Revocation stops future Nomad-mediated reads; it cannot guarantee deletion of context already disclosed to a provider or copied into a downstream answer

### FR-5 Evidence and audit

- Append-only evidence events
- Integrity chaining with externally anchored checkpoints before production pilot
- Search by actor, tool, action, policy, scope, outcome, and time
- Export in machine-readable and human-readable formats
- No sensitive plaintext copied into audit events
- Employee-visible access history and administrator/auditor evidence derive from the same event identifiers, with role-appropriate redaction

### FR-6 Integration gateway

- Remote MCP server as the primary initial integration surface
- REST API for controlled internal integrations
- OAuth 2.1 authorization and audience-bound tokens
- Nomad does not require users' AI-provider passwords or clients' model API keys for ordinary context serving
- Separate read and proposal tools
- Idempotency for mutations
- Rate limiting, retry behavior, and revocation

### FR-7 Data lifecycle

- Field expiration and review reminders
- Tenant-defined retention rules
- User and administrator deletion workflows with documented authority boundaries
- Portable export of passport fields, policies applicable to the subject, and evidence metadata

## 10. Initial integration scope

### First supported clients

1. Claude remote MCP connector
2. ChatGPT remote MCP integration
3. Generic MCP-compatible client for development and testing

### Subsequent clients

- Gemini API remote MCP, only if a future enterprise customer funds and approves the separate API-based integration; a personal Gemini subscription does not cover its model/API usage
- Microsoft Copilot Studio MCP
- Approved internal enterprise agents

### Explicit limitation

Nomad does not claim direct synchronization with a vendor's private built-in memory. It operates as an external context sidecar invoked through supported tools and APIs.

The current M1 connector tests use personal accounts. They prove neither company-managed deployment nor administrator approval. Claude documents an Owner-controlled custom-connector path for Team and Enterprise plans; ChatGPT availability depends on account and workspace policy. Google's current Gemini custom-app feature is limited to personal Google Accounts in the US and is unavailable to work or school accounts. Therefore a successful personal Gemini Spark test must not be presented as an enterprise Gemini integration. Each enterprise client must pass a separate live approval and tool-call test before being listed as supported in a customer contract.

Browser DOM scraping and silent transcript capture are excluded from the enterprise MVP because they are fragile, difficult to govern, and may violate platform or organizational expectations.

## 11. Security and privacy requirements

- The repository includes a deployed stateless MCP diagnostic endpoint, but not a deployed secure context service. The diagnostic endpoint serves no private context, and no live LLM credentials are stored here.
- Default client-to-Nomad integration: the AI client holds its own model credential and obtains a scoped token for Nomad. Nomad does not collect provider passwords or model API keys to serve context.
- Optional future outbound model or import connectors use tenant-scoped secrets in a managed secret store, envelope encryption under KMS, least-privilege workload identities, rotation, revocation, and deletion on disconnect.
- Web sessions use short-lived, `Secure`, `HttpOnly`, `SameSite` cookies with CSRF protection; bearer and refresh tokens never go into browser `localStorage`.
- TLS for all network communication
- Envelope encryption for sensitive field values
- Managed key lifecycle with rotation and tenant separation
- Secrets stored outside application configuration
- OAuth token rotation, expiration, revocation, and audience validation
- Server-side authorization on every request
- Prompt-injection-resistant boundaries: retrieved context is untrusted data, never executable policy
- Input and output schema validation
- DLP and sensitivity classification hooks
- Human approval for privileged or high-risk operations
- Tenant-isolation tests and negative authorization tests
- Data minimization in logs, analytics, and evidence events
- Incident-response runbook and connector kill switch
- Backup, restoration, deletion, and cryptographic-erasure procedures
- Secret and context redaction tests across logs, traces, analytics, errors, evidence exports, and backups
- Independent security review and penetration testing before production

The implementable credential decision table and acceptance tests are in `docs/CREDENTIALS_AND_TRUST_BOUNDARY.md`. Encryption and a secret manager are controls, not a guarantee of security.

### 11.1 Memory-poisoning threat model

Imported, retrieved, or assistant-proposed context is untrusted data. The 2024 PoisonedRAG paper reported 90% attack success in its tested setting with five malicious texts per target question inside a database of millions; that figure must not be generalized to Nomad or all RAG systems. Microsoft's February 2026 investigation of AI recommendation poisoning documented attempts to place persistent instructions in assistant memory through prefilled prompts, with effectiveness varying by platform. Nomad's response is to separate proposals from committed fields, retain source evidence, prevent content from acting as policy, and require review for sensitive or inferred facts.

### 11.2 Regulatory framing

The EU AI Act entered into force in 2024 and generally became applicable on 2 August 2026, with important high-risk provisions on later 2027/2028 schedules. This is **not** "full enforcement of every provision" and the Act has not been shown to create a general AI-memory portability right. GDPR Article 20 creates a conditional portability right for qualifying personal data, not every inferred memory or employer-owned record. Nomad should be positioned as addressing customer governance needs; legal compliance claims require jurisdiction- and workflow-specific counsel review.

## 12. Non-functional requirements

- **Availability:** graceful denial when policy or identity dependencies are unavailable; never fail open.
- **Performance:** authorization overhead measured separately from model latency; target set after pilot baseline.
- **Accessibility:** WCAG 2.2 AA for the web application.
- **Observability:** structured operational metrics without context values.
- **Portability:** documented schemas and complete customer export.
- **Maintainability:** modular monolith until scale demonstrates a need for service separation.
- **Deployability:** repeatable environments, automated migration checks, and rollback support.

## 13. Success measures

Targets will be set after discovery and baseline measurement. The product will measure:

- Repeated-context reduction per supported workflow
- Percentage of context reads allowed without over-broad grants
- Proposal approval, edit, and rejection rates
- Time required to answer "who accessed what and why"
- Revocation propagation time
- Context accuracy and stale-field rate
- Policy exception volume
- Active users across two or more approved AI tools
- Percentage of users who can correctly explain a proposed release and revoke it without support
- Share of requests constrained by an employee choice that is narrower than organization policy
- Time to resolve a proposed context error or conflicting value
- Pilot renewal or expansion intent
- Security and privacy incidents attributable to context exchange

## 14. Commercial hypothesis

The initial customer hypothesis is a regulated or security-conscious organization that:

- Uses at least two AI assistants or agent platforms
- Has an internal AI platform, security, or governance owner
- Experiences repeated-context cost or inconsistent agent behavior
- Cannot permit unrestricted transcript sharing
- Will fund a controlled pilot to establish policy, evidence, and employee trust

This remains a hypothesis until validated through buyer interviews and design partners.

## 15. Milestone gates

Nomad uses outcome-based gates. A milestone advances only when its evidence is complete.

### Gate 0 - Product thesis and public-source market correction - Complete

- Reviewed original PRD and architecture
- Validated major vendor portability and MCP capabilities
- Identified direct competitors and standards; named public-source comparison and unknowns documented
- Repositioned from universal memory to an employee-readable context-release workflow within enterprise governance
- Defined buyer, champion, control stakeholders, and daily-user personas

### Gate 1 - Experience and contract validation - In progress

- Revised PRD v2.1 available for review, not yet approved
- Three new light interface directions available for user selection
- Primary workflows and terminology confirmed
- Context field, proposal, grant, policy, and evidence contracts reviewed
- At least five customer discovery conversations completed before production scope is locked

### Gate 2 - Trust foundation

- Tenant, identity, and authorization model implemented
- Context schema and versioning implemented
- Proposal workflow and append-only evidence implemented
- Threat model and abuse cases reviewed
- Automated tenant-isolation and negative-authorization tests passing

### Gate 3 - Employee passport

- Employee home, passport, access, approvals, and activity experiences implemented
- Export, expiration, revocation, and deletion workflows working end to end
- Accessibility review passing

### Gate 4 - Integration proof

- Generic MCP client passing contract tests
- Claude and ChatGPT integrations demonstrating controlled reads and proposals
- No native-memory synchronization claims
- Prompt-injection and excessive-agency tests passing

### Gate 5 - Enterprise control plane

- Administrator policies, integrations, people/groups, evidence, and lifecycle controls implemented
- SSO and provisioning operational
- Policy simulation and connector kill switch tested

### Gate 6 - Pilot readiness

- Deployment, backup, restore, monitoring, and incident response exercised
- Security and privacy review completed
- Pilot onboarding and support material complete
- Success baseline and pilot exit criteria agreed with a design partner

### Gate 7 - Customer pilot

- One real organization uses two supported AI clients
- Pilot metrics and qualitative evidence collected
- Gaps prioritized from observed behavior rather than speculation
- Expansion, revision, or stop decision documented

### Gate 8 - Production readiness

- External security testing and remediation complete
- Reliability objectives based on pilot usage established
- Legal, privacy, support, and commercial operating processes ready
- Production launch decision approved

## 16. Out of scope for the first production pilot

- A proprietary vector database or novel memory-retrieval algorithm
- Silent capture of complete conversations
- Consumer social or relationship memory
- Marketplace of third-party context providers
- Automatic synchronization with native vendor memory
- Custom model training
- Fully autonomous context writes
- Mobile-native applications
- Broad public launch before a controlled enterprise pilot

## 17. Key risks and responses

| Risk | Product response |
|---|---|
| Existing memory vendors add governance | Focus on cross-vendor policy, purpose limitation, employee visibility, and evidence interoperability |
| Existing vendors already claim consent, audit, and policy features | Compare real workflows and documentation line by line; avoid generic uniqueness claims; test the dual-control release workflow with buyers |
| AI tool writes poisoned or incorrect context | Proposal quarantine, provenance, validation, human review, versioning, and rollback |
| Product becomes employee surveillance | No productivity scoring, content-minimized evidence, employee visibility, and explicit governance charter |
| Vendor integration changes | MCP-first contracts, adapter isolation, capability registry, and conformance tests |
| Policy rules become unusable | Structured defaults, simulation, explainable decisions, and progressive disclosure |
| Audit log is altered by privileged operators | Append-only storage plus externally anchored integrity checkpoints |
| Legal claims exceed actual rights | Treat GDPR portability as scoped; do not claim an EU AI Act memory-portability mandate |
| Provider credentials are mishandled | Keep model keys outside Nomad's default boundary; use managed, tenant-scoped secrets only for optional outbound integrations and test every secret-exposure path |

## 18. Open decisions requiring validation

1. First design-partner industry and regulatory environment
2. Whether the employer or employee owns each organization-context category
3. Default approval threshold for low-risk tool proposals
4. Customer-managed keys at pilot or after pilot
5. Required evidence retention periods
6. Whether personal passports are offered inside an enterprise tenant or remain a later consumer product
7. Commercial packaging: platform fee, active user, connected client, or evidence volume
8. Which single buyer-valued workflow best distinguishes Nomad after direct competitor demos: field release, context correction, or dual-control revocation
9. Which light interface concept (A, B, or C) the user chooses as the starting experience

## 19. Current project record

### Completed

- Installed the requested development and product-design skills
- Inspected the original thirteen-page PRD and architecture diagram
- Completed initial and refreshed primary-source vendor, standards, security, and regulatory research; hands-on competitor trials remain open
- Identified buyer, control, technical-champion, and daily-user personas
- Corrected the positioning and regulatory narrative
- Established an initial design system, then replaced the dark/green direction with three light concepts for review
- Produced the revised PRD and milestone framework

### Built in this iteration

- Earlier clickable three-variant dark/green interface prototype, retained only as historical exploration
- Employee and administrator navigation model
- Interactive approval, access, activity, and policy examples
- Three new static, light-interface mockups for selection
- Credential-handling architecture and security acceptance tests; no live credentials or production backend
- Presentation-ready v2.1 PRD PDF with the new light mockups

### First production work after user selection and design-partner validation

1. Freeze terminology and domain contracts.
2. Write the threat model and authorization decision table.
3. Create the production repository structure.
4. Implement tenancy, identity, schema migrations, and policy enforcement tests.
5. Add the first employee passport workflow.
6. Add the generic MCP integration and contract tests.

## 20. References

- MemoryLake product page: https://www.memorylake.ai/
- Supermemory product page: https://supermemory.ai/product/
- Mem0 OpenMemory: https://mem0.ai/openmemory
- Zep product page: https://www.getzep.com/
- MemSync product page: https://www.memsync.ai/
- MemOS product page: https://memos.openmem.net/
- Atlan product page: https://atlan.com/
- Kiteworks Compliant AI: https://www.kiteworks.com/platform/compliance/compliant-ai/
- MintMCP product page: https://www.mintmcp.com/
- Model Context Protocol: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- OpenAI MCP guidance: https://developers.openai.com/plugins/build/mcp-server
- Anthropic remote MCP connectors: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Gemini function calling and remote MCP: https://ai.google.dev/gemini-api/docs/function-calling
- Microsoft Copilot Studio MCP: https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp
- GDPR Article 20: https://eur-lex.europa.eu/eli/reg/2016/679/art_20/oj/eng
- EU AI Act: https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- European Commission AI Act implementation: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- PoisonedRAG original paper: https://arxiv.org/abs/2402.07867
- Microsoft AI recommendation poisoning: https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/
- OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
