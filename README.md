# Nomad

Nomad is a user-owned context layer that ChatGPT and Claude can read through a remote MCP connector. The [17 September 2026 build plan](docs/BUILD_PLAN.md) is the working milestone scope. Nomad is not a replacement chat model.

## Current status

M1's web exit criteria are met. ChatGPT web and Claude web made live diagnostic tool calls, including natural prompts that did not name the tool. Twenty successful timed calls on each web client are recorded in [the M1 evidence record](docs/M1_FEASIBILITY.md); Claude mobile remains untested.

M2 client acceptance is nearly complete. The isolated authenticated Worker is deployed at `https://nomad-core.nomad-mcp-feasibility.workers.dev`; Google sign-in, authenticated ChatGPT and Claude reads, sealed-field exclusion, labeled audit rows, hosted `search`/`fetch`, and the two-client proposal collision all passed. The remaining M2 acceptance item is a run inside ChatGPT's Deep Research mode. See [M2 validation evidence](docs/M2_VALIDATION.md).

M3–M8 is implemented and deployed: quiet consent, trusted updates, R2 file extraction and retrieval, cross-client thread handoff, onboarding and install surfaces, export and hard deletion, usage guardrails, a 40-scenario evaluation set, metrics, demo script, and case-study draft. The production D1 migration is applied and the `nomad-files` R2 bucket is active. A hosted ChatGPT file read and save followed by a Claude thread retrieval passed. Human exit criteria remain recorded as field evidence rather than being inferred from unit tests. See [M3–M8 validation](docs/M3_M8_VALIDATION.md).

Enterprise production readiness is tracked separately in [the production readiness record](docs/PRODUCTION_READINESS.md). The current deployment is a personal pilot and does not yet implement the organization tenancy, roles, SSO/provisioning, organization policy intersection, integrity-linked evidence, or tenant lifecycle controls required by the enterprise PRD.

## Artifacts

- `docs/BUILD_PLAN.md` - current milestone scope and acceptance criteria
- `apps/mcp-worker/` - deployed, data-free M1 diagnostic Worker
- `apps/nomad-worker/` - authenticated M2–M8 Worker, passport, file and thread storage, evaluation surface, and setup guide
- `docs/M2_VALIDATION.md` - observed M2 tests and remaining live acceptance checks
- `docs/M3_M8_VALIDATION.md` - implementation matrix, automated evidence, hosted prompt budget, and remaining field evidence
- `docs/DEMO_SCRIPT.md` and `docs/CASE_STUDY.md` - M8 evidence artifacts
- `docs/Nomad_PRD_v2.0.md` and `docs/Nomad_PRD_v2.1.md` - earlier product requirements and enterprise exploration
- `docs/COMPETITIVE_RESEARCH_2026-09.md` - primary-source market and claims review
- `docs/COMPETITOR_REQUIREMENTS_MATRIX.md` - MemoryLake/Supermemory comparison against Nomad requirements
- `docs/IMPLEMENTATION_PLAN.md` - earlier enterprise build order; the current M1 gate is in `docs/BUILD_PLAN.md`
- `docs/M1_FEASIBILITY.md` - live connector test status and go/no-go criteria
- `docs/CREDENTIALS_AND_TRUST_BOUNDARY.md` - proposed credential and security architecture
- `docs/UI_DIRECTIONS.md` - earlier light interface concepts for review
- `design-system/nomad/MASTER.md` - provisional light direction notes
- `prototype/nomad-ui-prototype.html` - historical dark/green clickable prototype; not the current proposed UI
- `prototype/mockups/nomad-landing-aurora.html` - earlier light landing preview with product-neutral sample content
- `output/pdf/Nomad_PRD_v2.0.pdf` - prior presentation-ready PRD
- `output/pdf/Nomad_PRD_v2.1.pdf` - earlier enterprise export; M1 status is tracked separately

## Review the earlier interface concepts

Open `prototype/mockups/nomad-landing-aurora.html` for a light, responsive preview. Its assistant activity is illustrative, not live. These prototypes were made for the earlier enterprise direction; they are not an M1 deliverable.

## View the earlier prototype

Open `prototype/nomad-ui-prototype.html` directly in a browser, or run:

```bash
python3 -m http.server 4173 --directory prototype
```

Then visit `http://localhost:4173/nomad-ui-prototype.html`.

Use the bottom switcher or the left/right arrow keys to compare:

- Variant A - Control Center
- Variant B - Passport First
- Variant C - Evidence Ledger

This earlier prototype is intentionally dependency-free and contains no production persistence or backend calls. Its dark/green styling has been superseded by the light concepts.
