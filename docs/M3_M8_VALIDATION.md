# M3–M8 implementation and validation · 19 September 2026

The remaining Nomad milestone software is implemented in `apps/nomad-worker`. Automated checks use synthetic local data. Hosted-client checks are deliberately limited to one or two prompts per milestone.

| Milestone | Implemented | Automated evidence | Field evidence still required |
|---|---|---|---|
| M3 · Quiet consent | Per-client `ask`/`auto` trust, silent new facts, automatic trusted overwrites, proposal dedupe and auto-supersede, batched review digest, two-button review cards, version history, decision timestamps and median metric | Trusted overwrite creates version 2 without a proposal; ten same-field proposals leave one pending and nine superseded; history and trust forms pass integration tests | Record real median decision time after enough proposals. Investigate if it falls below two seconds. |
| M4 · Files | R2 upload, PDF/Markdown/text extraction, one-time SHA-256 dedupe, heading-aware chunks capped at 800 estimated tokens, outlines, FTS5, `list_files`, `get_file_chunk`, and file-aware `search`/`fetch` | A generated 31-page PDF extracts once and page 31 is searchable; a controlled 20-query keyword set records 0 misses; duplicate upload keeps `extraction_count = 1`; production accepted a Markdown file, extracted it once, and ChatGPT returned its unique phrase | Repeat the hosted check with a representative user PDF. Repeat the 20-query measurement on real documents before deciding whether vectors are justified. |
| M5 · Thread handoff | `save_thread`, `list_threads`, `get_thread`, provenance, verbatim PWA paste path, thread list/detail, and a warning on model summaries | ChatGPT saved a model summary in production; after refreshing Claude's cached connector schema, Claude discovered it with `list_threads` and returned the exact content with `get_thread`; ten local verbatim captures return byte-for-byte text | Measure semantic loss on ten real model summaries. |
| M6 · Product surface | Public landing, setup, limits, install instructions, three-question onboarding, JSON memory import, manifest, service worker registration, mobile metadata, and one visual system | Public routes and standalone manifest pass integration tests | Install on Android, iPhone, and desktop. Time three new users completing setup unaided. |
| M7 · Hardening | Injection-safe envelopes and control stripping, sealed-field isolation, provider encryption at rest, complete export, hard delete across D1/KV/R2, 80%-of-free-tier warning counters, metrics warnings, and automatic read-only writes | Injection, export, hard delete, sealed exclusion, usage warning, and read-only transition pass integration tests | Run the 7-day pilot with 10–20 users. Cloudflare-managed D1 and R2 encryption at rest must remain enabled in the production account. |
| M8 · Evidence | Forty shared scenarios, result recording for ChatGPT and Claude, automatic pass scoring, metrics dashboard, demo script, and case-study draft | Scenario count/schema and result scoring pass integration tests | Run the scenario set by hand within the user's prompt budget, record a real product change from the results, and record the demo video. |

## Current measured development results

- Full local suite: **12/12 tests pass** after the M4 PDF case, access-revocation regression, and evidence additions.
- M4 controlled keyword miss rate: **0/20** on a synthetic fixture. This is a pipeline check, not a claim about real-document recall.
- M4 extraction count: **1** for the original and duplicate upload of identical content.
- M5 verbatim preservation: **10/10 exact** on synthetic threads of increasing length.
- M4 hosted check: `nomad-hosted-validation.md` reached `ready`, reported `extracted 1 time`, and ChatGPT returned the unique phrase **cobalt compass**.
- M5 hosted handoff: ChatGPT saved `M5 hosted handoff check`; Claude returned capture kind `model_summarized` and exact content `Nomad M3-M8 deployment completed and R2 is enabled.`
- M2 hosted trigger result remains the first adoption signal: ChatGPT natural prompts **0/5**, direct prompts **4/5**.

## Hosted prompt budget

- M3: one prompt that explicitly updates an existing field, then inspect whether trust mode applies or queues it.
- M4: one prompt that asks a question whose answer exists only in an uploaded PDF.
- M5: two prompts total, one to save in ChatGPT and one to retrieve in Claude.
- M6: no assistant prompt; use the human setup timer.
- M7: one stored injection prompt plus audit inspection during the pilot.
- M8: use the evaluation page and run scenarios gradually; do not flood either hosted client.

Exit criteria tied to elapsed time, independent people, physical devices, or hosted model behavior remain evidence collection tasks. They are not represented as completed by unit tests.

## Deployment state

Migration `0002_milestones.sql` is applied to the production D1 database. Cloudflare R2 is enabled and the Standard storage bucket `nomad-files` exists. M3–M8 Worker version `85fefd21-25e4-4337-8020-e6a2ad469a61` is deployed. The live `/health` response reports `status: ok`, `phase: M8`, and `googleConfigured: true`.

ChatGPT initially held the pre-M5 tool schema. Its built-in Refresh control loaded `list_threads` and `save_thread`. Claude also held the old schema; disconnecting and reconnecting Nomad Passport refreshed it. Both hosted clients then exercised the current production tools successfully.

The in-product free-tier counters are conservative application-side guardrails based on operations Nomad records. They do not replace Cloudflare account billing and usage alerts. Enable the provider alerts before starting the M7 pilot.
