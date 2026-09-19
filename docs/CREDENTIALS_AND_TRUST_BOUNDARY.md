# Nomad credentials and trust boundary

**Status:** design proposal, not an implemented security claim. The repository also contains a deployed, stateless MCP diagnostic endpoint for connector feasibility tests. That endpoint serves no private context and is not the production trust boundary described below. There is no authenticated enterprise backend or stored Gemini, Claude, ChatGPT, or other LLM credential.

## Default architecture: no provider credential in Nomad

Claude, ChatGPT, Gemini-based applications, and enterprise agents are *clients* of Nomad's context API or MCP endpoint. A supported client authenticates to Nomad and receives only the fields authorized for its user, organization, purpose, scope, and operation. Nomad does not need the user's Claude/ChatGPT/Gemini password or the client's model API key to answer a context request. The client or its operator remains responsible for the model credential on its own side of the boundary.

Nomad's first pilot should not call a model to make policy decisions. Policy evaluation is deterministic. Extracting proposed memories with a model is optional and should be added only after the core access/proposal workflow works safely.

## If credentials are required later

| Credential | Owner and location | Nomad handling |
|---|---|---|
| Employee sign-in | Enterprise identity provider | OIDC/SSO; short-lived server session. No identity-provider password in Nomad. |
| AI client's access to Nomad | Client obtains a purpose- and audience-bound OAuth token | Validate signature, issuer, audience, expiry, tenant, user, client, scopes, and revocation on every request. Do not log the bearer token. |
| Gemini/Claude/OpenAI model API key used by an enterprise application | That application or its enterprise operator | Not copied into Nomad for context serving. |
| Optional Nomad-operated model API key | Tenant-controlled integration, managed secret store | Encrypted at rest with a managed KMS key; only the execution identity for that integration may read it. No plaintext in app config, source, logs, analytics, or browser storage. Prefer workload identity when a provider supports it. |
| Optional provider OAuth refresh token for a future import connector | Tenant-scoped encrypted credential record | Encrypt with envelope encryption, restrict to the import worker, rotate/revoke, and delete on disconnect. Do not request a user's password or scrape a browser session. |
| Nomad-issued service/API key, if offered | Customer service client | Show once; store only a slow or keyed hash plus key ID, scope, owner, expiry, and revocation metadata. |

## Browser and session rules

- A web session uses a server-issued, short-lived `Secure`, `HttpOnly`, `SameSite` cookie and CSRF protection. Never place access tokens, refresh tokens, model keys, or unencrypted context in `localStorage`.
- Admin credential-management pages show only labels, last four characters when appropriate, creator, scope, last use, expiry, and rotation status. They never reveal a stored secret again.
- Secret submission is over TLS, with input redaction in traces and request logs. The UI makes clear whether a credential belongs to Nomad or remains with the connected AI application.

## Authorization and data protections

- Every request is deny-by-default and bound to one tenant, person, tool identity, operation, purpose, project/client scope, field set, and time window.
- Effective access is the intersection of organization policy, data ownership rules, and the individual's narrower choice. An employee cannot authorize release of employer/client data that organization policy prohibits.
- Context values are envelope encrypted at rest, with managed key rotation, tenant separation, minimal plaintext lifetime, and encrypted backups. Audit events record identifiers and decisions, not copied sensitive values.
- A connector can be disabled immediately; active grants and tokens must be revocable, with tested propagation time.
- Proposed context is untrusted input. It is validated, classified, quarantined, and approved under policy before becoming trusted context. Retrieved text cannot act as policy or instructions.

## Minimum security acceptance tests before a customer pilot

1. Cross-tenant and cross-client reads fail closed, including attempts using an otherwise valid token.
2. Expired, revoked, wrong-audience, and insufficient-scope tokens fail.
3. A secret or sensitive context value cannot be found in logs, traces, analytics, evidence exports, browser storage, or error responses.
4. Disconnecting a connector revokes access and, where supported, its downstream token; the measured delay is documented.
5. Backup restore and key rotation retain authorization boundaries and do not expose plaintext secrets.
6. A prompt-injection payload inside imported or proposed context cannot change policy or grant access.
7. Independent security review and penetration testing address the public MCP/API surface before production.

## Honest security statement

This is a security architecture, not proof that the deployed product is secure. A secret manager, encryption, and OAuth reduce exposure but cannot eliminate compromise from stolen client tokens, flawed policy code, malicious administrators, provider incidents, or bad configuration. Nomad must demonstrate the above tests and an incident-response process before accepting real customer data.
