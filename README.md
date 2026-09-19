# Nomad

Nomad is a user-owned context layer for AI assistants. It gives a user one place to store selected preferences, project facts, files, and conversation handoffs, then makes that information available to ChatGPT and Claude through a remote Model Context Protocol (MCP) connector.

Nomad does not replace an assistant or call a model API. The user continues working inside ChatGPT or Claude, and the assistant calls Nomad only when it needs approved context.

## Project objective

The project is building a portable context passport that lets a user:

- Save useful facts once and retrieve them from multiple assistants.
- Search uploaded text, Markdown, and PDF files without uploading the same file to every assistant.
- Move a conversation summary or transcript from one assistant to another.
- Review proposed changes before they overwrite existing context.
- Keep sealed fields out of every assistant response.
- See which connected client read or proposed a change.
- Export all stored information or permanently delete the account.

The current implementation is a personal pilot. Enterprise requirements such as organization tenancy, roles, SSO, provisioning, retention policy, legal holds, and independent security approval remain separate production gates.

## Why Nomad is being built

Each AI assistant keeps memory inside its own product. A user who changes assistants must repeat preferences, copy project background, re-upload files, and manually summarize prior conversations. That creates duplicated work and makes the user dependent on one provider.

Nomad provides a vendor-neutral layer between the user and those assistants. The user chooses what to store, what each connector can read or write, and whether a proposed update needs review. This makes context portable while preserving a clear control and audit surface.

## How it works

```text
ChatGPT web ----\
                 +--- MCP over HTTPS ---> Nomad Worker ---> D1 context and search
Claude web ------/                         |              \-> R2 file objects
                                            \-> KV sessions and OAuth state

Nomad web app ---------------------------> passport, review, audit, export, delete
```

Nomad has two deployed Workers:

1. `apps/mcp-worker` is the public, data-free M1 diagnostic endpoint. Its only tool proves that a hosted assistant can reach a remote MCP server.
2. `apps/nomad-worker` is the authenticated product Worker. It serves the web passport, Google sign-in, OAuth-protected MCP tools, storage, search, review, audit, evaluation, and account controls.

The product Worker exposes these MCP tools:

| Capability | Tools |
|---|---|
| Load and search context | `get_context`, `search_context` |
| Save a user-approved fact | `save_context` |
| Find and retrieve file content | `list_files`, `get_file_chunk` |
| Move conversations between assistants | `save_thread`, `list_threads`, `get_thread` |
| Support ChatGPT Deep Research | `search`, `fetch` |

Read tools are marked read-only. Write tools require an OAuth write scope and an explicit user request. Existing values normally become reviewable proposals; a user may separately trust a client for automatic explicit updates. Stored values and extracted file text are returned as untrusted data, never as instructions.

## Main features

### Context passport

- Organizes facts by project and key.
- Maintains append-only field history.
- Supports normal, sensitive, and sealed sensitivity levels.
- Excludes sealed values from assistant tools.
- Provides full-text search with D1 FTS5.

### Review and audit

- Labels each connected OAuth client with a user-selected name.
- Records assistant reads without storing unnecessary response content.
- Queues conflicting updates as proposals.
- Supersedes stale proposals instead of applying them over newer data.
- Supports per-client review or trusted-update modes.

### Files and conversation handoff

- Stores original file objects in R2.
- Extracts text from PDF, Markdown, and plain-text files.
- Splits extracted text into bounded, searchable chunks.
- Deduplicates repeated uploads by SHA-256.
- Preserves thread provenance and whether a capture is verbatim or model summarized.

### User control and operations

- Google sign-in and OAuth-protected MCP access.
- Installable web app with onboarding and connector setup instructions.
- Account export and hard deletion across D1, KV, and R2.
- Rate limits, usage guardrails, and read-only degradation.
- Staging and production deployments, CI, smoke monitoring, and incident alerts.

## Technology stack

| Component | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Cloudflare Workers |
| MCP server | Model Context Protocol server and Cloudflare Agents SDK |
| Authentication | Google OpenID Connect and Cloudflare Workers OAuth Provider |
| Structured data | Cloudflare D1 |
| Full-text search | SQLite FTS5 in D1 |
| Sessions and OAuth state | Cloudflare KV |
| File storage | Cloudflare R2 |
| Validation | Zod |
| Tests | Node test runner with local Wrangler bindings |
| CI and deployment | GitHub Actions and Wrangler |

## Repository structure

```text
Nomad/
|-- apps/
|   |-- mcp-worker/          # Data-free M1 connection and latency probe
|   `-- nomad-worker/        # Authenticated product Worker and web app
|       |-- migrations/      # D1 schema migrations
|       |-- scripts/         # Deployment smoke check
|       |-- src/             # Auth, MCP tools, storage, files, UI, and metrics
|       `-- test/            # Milestone and storage integration tests
|-- docs/                    # Build plan, validation evidence, operations, and PRDs
|-- prototype/               # Historical interface prototypes and mockups
|-- design-system/           # Provisional visual direction
|-- output/pdf/              # Generated PRD documents
|-- README.md
`-- LICENSE
```

## Milestone status

| Milestone | Result |
|---|---|
| M1: MCP feasibility | Passed on ChatGPT web and Claude web, including live tool calls and 20 timed calls per client. Claude mobile remains untested. |
| M2: Authenticated context | Google sign-in, OAuth, real context reads, sealed-field exclusion, audit labels, search/fetch, and proposal collision passed. A ChatGPT Deep Research run remains. |
| M3: Quiet consent | Implemented with review proposals, trusted explicit updates, deduplication, supersession, and change history. Real decision-time evidence remains. |
| M4: Files | Implemented with R2 storage, extraction, chunking, deduplication, and search. A representative real-user PDF check remains. |
| M5: Thread handoff | ChatGPT-to-Claude hosted handoff passed. More real summaries are needed to measure information loss. |
| M6: Product surface | Landing, setup, onboarding, import, install, limits, and PWA routes are implemented. Multi-device installation and new-user timing remain. |
| M7: Hardening | Isolation, injection boundaries, export, deletion, guardrails, and read-only mode are implemented and covered locally. The multi-user pilot remains. |
| M8: Evidence | Forty scenarios, scoring, metrics, demo script, and case-study draft are implemented. Manual client evaluation and the final demo remain. |

Detailed evidence is recorded in [M1 feasibility](docs/M1_FEASIBILITY.md), [M2 validation](docs/M2_VALIDATION.md), and [M3-M8 validation](docs/M3_M8_VALIDATION.md).

## Running the project locally

### Requirements

- Node.js 24 or later
- pnpm 10
- A Cloudflare account for remote deployment
- A Google OAuth web client for live Google sign-in

Clone the repository:

```sh
git clone https://github.com/Nomad-co/Nomad.git
cd Nomad
```

### Run the authenticated Nomad Worker

```sh
cd apps/nomad-worker
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm dev
```

The local Worker uses Wrangler's local D1, KV, and R2 bindings. The test command applies local migrations before running the integration suite.

### Run the M1 diagnostic Worker

In a separate checkout or terminal:

```sh
cd apps/mcp-worker
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm dev
```

Then run its MCP protocol check from another terminal:

```sh
cd apps/mcp-worker
pnpm test:mcp
```

Do not submit personal data to the M1 diagnostic Worker. It is public and intentionally unauthenticated.

## Testing

The main local verification is:

```sh
cd apps/nomad-worker
pnpm typecheck
pnpm test
```

The suite covers user isolation, sealed-field exclusion, audit records, conflicting proposals, trusted updates, file extraction and search, thread handoff, public routes, injection handling, export, access revocation, hard deletion, usage degradation, evaluation scoring, and stale edits.

For a deployed environment, run:

```sh
cd apps/nomad-worker
NOMAD_ORIGIN=https://your-worker.example EXPECTED_ENVIRONMENT=staging node scripts/smoke.mjs
```

Hosted ChatGPT and Claude checks are intentionally limited to one or two prompts per milestone. Automated tests establish deterministic behavior; hosted checks establish that the actual assistant client can discover and call the deployed tools.

## Deployment

GitHub Actions contains separate staging and production deployment paths. Each deployment installs locked dependencies, runs type checking and tests, applies the correct D1 migrations, deploys the Worker, and runs the smoke script.

Current pilot endpoints:

- Production pilot: `https://nomad-core.nomad-mcp-feasibility.workers.dev`
- Staging: `https://nomad-core-staging.nomad-mcp-feasibility.workers.dev`
- Data-free M1 probe: `https://nomad-mcp-feasibility.nomad-mcp-feasibility.workers.dev/mcp`

Production deployments require the protected GitHub environment and reviewer approval. Secrets belong in Cloudflare or GitHub environment secrets and must never be committed.

## Using Nomad with an assistant

1. Open the Nomad web app and sign in with Google.
2. Add selected context through onboarding or the passport.
3. Add the product `/mcp` URL as a custom connector in ChatGPT web or Claude.
4. Complete the OAuth flow and give the client a recognizable label.
5. Ask the assistant to load saved context, search a file, save an explicit fact, or retrieve a saved thread.
6. Review proposed overwrites and the audit log in the Nomad web app.

ChatGPT custom connectors are used on the web. Claude can use a remote custom connector when the account or workspace permits it. Assistant providers control tool discovery and when a model chooses to call a connector, so direct prompts are more reliable than assuming automatic invocation.

## Current limitations and production work

Nomad is ready for controlled personal-pilot use, subject to the published pilot terms. It is not ready for company or regulated data.

The remaining production foundations include:

- An owned production domain and completed Google OAuth publication or verification.
- A second accountable alert recipient and an acknowledged alert test.
- An authenticated staging connector read and write smoke test.
- A repeatable logical D1 backup because native D1 export fails on FTS5 virtual tables.
- A private application recovery test and a non-empty R2 restore drill.
- An independent security review and closure of critical or high findings.
- A design-partner pilot with approved assistants and recorded exit evidence.
- Enterprise tenancy, roles, SSO, provisioning, policy enforcement, retention, legal hold, and organization incident controls.

See [Production readiness](docs/PRODUCTION_READINESS.md), [Operations runbook](docs/OPERATIONS_RUNBOOK.md), and [Security review scope](docs/SECURITY_REVIEW_SCOPE.md) for the release gates.

## Documentation

- [Build plan](docs/BUILD_PLAN.md): milestone scope and acceptance criteria
- [M1 feasibility](docs/M1_FEASIBILITY.md): remote MCP and client latency evidence
- [M2 validation](docs/M2_VALIDATION.md): authenticated context acceptance evidence
- [M3-M8 validation](docs/M3_M8_VALIDATION.md): implementation and field-evidence matrix
- [Demo script](docs/DEMO_SCRIPT.md): two-minute product demonstration
- [Case study](docs/CASE_STUDY.md): current project narrative and results
- [Credential and trust boundary](docs/CREDENTIALS_AND_TRUST_BOUNDARY.md): security architecture
- [Production readiness](docs/PRODUCTION_READINESS.md): pilot and enterprise gates
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md): deployment, incidents, and recovery

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
