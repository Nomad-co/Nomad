# Nomad - Complete Build Plan

**Version 2.0 · 17 September 2026**

---

## READ THIS FIRST

This document is self-contained. If you are an LLM picking this up with no prior conversation, everything you need is here. Do not ask for missing context and do not infer requirements that are not written down.

Two rules for anyone working from this plan:

1. **The constraints in Section 3 are verified against primary sources.** They are not assumptions. Do not contradict them from training data, which may be out of date. If you believe one is wrong, check the cited source before acting.
2. **Confirm scope before starting any milestone.** Each milestone below has a gate. State what you plan to build and what is realistically achievable, get agreement, then build. Do not begin a milestone because the previous one finished.

---

## 1. What Nomad is

A user-owned context layer that sits above every AI assistant you use.

You keep your context once, in one place you control. ChatGPT and Claude connect to it as a custom MCP connector and read from it while you chat in them normally. Instead of re-explaining yourself to each new model, each model asks Nomad.

**The product is two things at one address:**

| Piece | What it is | How often the user touches it |
|---|---|---|
| `https://nomad.app/mcp` | Connector URL pasted into ChatGPT and Claude settings | Once, at setup |
| `https://nomad.app` | Web app (installable PWA) to view context, upload files, review changes | Occasionally, maybe weekly |

The value happens inside ChatGPT and Claude. Nomad itself is mostly invisible after setup.

**Setup, once, about four minutes:** sign in with Google, seed context from three questions or an existing memory export, copy the connector URL, paste into ChatGPT, paste into Claude, done.

---

## 2. The problem

If you use more than one LLM, your context is trapped in whichever one you built it in.

Every major assistant now has memory, and every one of them locks that memory inside its own product. Moving between models means copy-paste, and copy-paste fails at exactly the things that matter:

- You cannot lift a few prompts out of the middle of a thread. It is all or nothing.
- You cannot move uploaded files at all. They are stuck where you put them.
- Re-pasting a whole conversation is painful, and long threads do not fit.

So you either spend the first ten minutes of every new chat re-explaining yourself, or you stay in one model even when another is better for the task.

Vendors have shipped memory import tools, but those are one-time text transfers of summaries. Nobody has built live, two-way portability, and no vendor has an incentive to, because lock-in is the point.

**Nomad is the bridge.** Vendor-neutral, user-owned, live.

**Not in scope:** Nomad is not a chat interface, not a model wrapper, and does not replace either assistant's own memory. It is a separate layer they read from and write to.

---

## 3. Verified platform constraints

Checked against primary sources on 17 September 2026. These shape the architecture and are not negotiable.

| # | Constraint | Consequence | Source |
|---|---|---|---|
| C1 | ChatGPT developer mode is available to Pro, Plus, Business, Enterprise and Education accounts **on the web**. No mobile. | Mobile flows go through the Nomad PWA. Never promise ChatGPT connectors on phone. | [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode) |
| C2 | ChatGPT **Deep Research** mode only ever uses two tools, `search` and `fetch`, with a fixed schema. Developer mode does not relax this. | Nomad must expose conforming `search` and `fetch` as first-class tools, not an afterthought. | [FastMCP ChatGPT integration](https://gofastmcp.com/integrations/chatgpt) |
| C3 | Developer mode **does** allow arbitrary tools including writes in normal chat mode. | Richer tools are fine for chat, they just will not exist inside Deep Research. | [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode) |
| C4 | Claude reaches custom connectors from Anthropic's cloud, not from the user's device. | The server must be public HTTPS. A localhost server will not work. | [Claude remote MCP docs](https://claude.com/docs/connectors/custom/remote-mcp) |
| C5 | Claude's connector documentation describes **tools only**. MCP resources are "application-driven", meaning the host decides whether to surface them. | Build everything on tools. Do not rely on MCP resources. | [MCP resources spec](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) |
| C6 | Tool lists are cached by hosted clients. Apps are refreshed **manually** to pull new tools, descriptions and server instructions. MCP defines `notifications/tools/list_changed` and the 2026-07-28 spec added `ttlMs`/`cacheScope`, but you cannot assume a push propagates. | **Never put user data in tool descriptions.** Descriptions stay static. All dynamic state travels in tool results. | [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode), [MCP 2026-07-28 spec](https://blog.modelcontextprotocol.io/posts/2026-07-28/) |
| C7 | `readOnlyHint` annotation marks read-only tools so they skip per-call confirmation. | Every read tool sets it. Without this the product is unusable within a day. | [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode) |
| C8 | The MCP `instructions` field carries cross-tool guidance to the model. | This is the primary lever for getting the model to call Nomad at all. | [OpenAI developer mode](https://developers.openai.com/api/docs/guides/developer-mode) |
| C9 | D1 supports SQLite **FTS5** full-text search including `fts5vocab`. | Search is free and needs no embedding model. No vector database required at MVP. | [D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/) |
| C10 | R2 free tier: 10 GB storage, 1M Class A ops, 10M Class B ops per month, egress free. | File storage is free at pilot scale. | [R2 pricing](https://developers.cloudflare.com/r2/pricing) |
| C11 | Workers free tier: 100,000 requests/day, 10 ms **CPU** per request. CPU time is not wall time; waiting on D1 does not count against it. | Constrains computation, not latency. Policy checks must be indexed lookups, not scans. | Cloudflare Workers limits |
| C12 | A free D1 account that crosses a daily limit has **every query fail** until midnight UTC. | Rate limiting ships in the first build session, not at hardening. | Cloudflare D1 limits |

**Unverified and must be measured, not assumed:**

- End-to-end tool call latency from either assistant. Depends on three hops none of which have been tested. Measured in M1.
- Thread capture fidelity, meaning how much a model loses when asked to save a conversation. Measured in M1.
- Tool-call rate, meaning how often the model calls Nomad when it should. Measured from M2 onward.

---

## 4. Architecture

The assistants are clients. Nomad is the server. No provider credential ever enters the system.

```
  ChatGPT (web)  ─┐
                  ├─ MCP over HTTPS ──▶  Nomad Worker  ──▶  D1  (fields, versions, metadata, FTS5)
  Claude (web +   ─┘                     (policy gate)   └─▶  R2  (file blobs)
  mobile)
                                              ▲
  Nomad PWA  ────────────────────────────────┘
  (desktop + mobile)
```

**Why this shape**

- Nomad never calls a model API and holds zero provider credentials. The user's existing subscription pays for the model. This is what makes it free to build and run.
- Every tool call passes a policy gate before touching storage. The gate is indexed lookups only, per C11.
- Stored context is treated as data, never as instructions. This is the prompt-injection defence and it is not optional.
- The PWA is the only write authority for sensitive changes.

**Hosting**

| Piece | Service | Free ceiling |
|---|---|---|
| MCP server + API | Cloudflare Workers | 100k req/day, 10 ms CPU |
| Database + search | Cloudflare D1 (SQLite + FTS5) | 5 GB, 5M row reads, 100k row writes/day |
| File blobs | Cloudflare R2 | 10 GB, 1M Class A, 10M Class B |
| PWA | Same Worker | Included |
| Auth | Workers OAuth Provider, Google sign-in | Free |

Free to build and pilot. Real multi-user scale means the $5/month Workers plan. State this honestly, it is not free forever.

---

## 5. Data model

Seven tables. SQLite, so the schema is portable off Cloudflare if needed.

```sql
users            id, email, created_at

fields           id, user_id, project, key, value, sensitivity,
                 version, updated_at, source_client_id
                 -- sensitivity: normal | sensitive | sealed
                 -- sealed is NEVER returned to any assistant

field_versions   id, field_id, value, actor, actor_kind, created_at
                 -- append-only, never updated or deleted

clients          id, user_id, label, oauth_client_id,
                 trust_mode, connected_at
                 -- trust_mode: ask | auto
                 -- label is assigned by the user, never self-reported

proposals        id, client_id, field_id, proposed_value, reason,
                 base_version, status, idempotency_key, created_at
                 -- status: pending | applied | rejected | superseded

threads          id, user_id, project, title, source_client_id,
                 capture_kind, token_count, created_at
                 -- capture_kind: verbatim | model_summarized

thread_segments  id, thread_id, seq, role, text

files            id, user_id, project, name, mime, size_bytes,
                 r2_key, outline, created_at

file_chunks      id, file_id, seq, heading, text
                 -- mirrored into an FTS5 virtual table

audit            id, user_id, client_id, action, target_ids,
                 value_hash, created_at
                 -- hashes, never raw sensitive values
```

**Concurrency.** LLMs never write directly. They propose. The only writer is the Nomad server acting on approval or on an `auto` trust setting. Conflicting proposals are resolved with compare-and-swap:

```sql
UPDATE fields SET value = ?, version = version + 1, updated_at = ?
WHERE id = ? AND version = ?;
-- 0 rows affected means the field moved. Mark the proposal superseded.
-- Never silently overwrite.
```

SQLite is single-writer and D1 serialises writes per database, so there is no storage-level tearing. The CAS handles logical conflicts only. `field_versions` is append-only, so a race can at worst produce an extra history row, never data loss.

`propose_update` takes an idempotency key, because tool calls get retried.

---

## 6. Tool contract

Eight tools. Every read tool sets `readOnlyHint: true` per C7.

### Required by ChatGPT Deep Research (C2)

```
search(query: string) -> { results: [{ id, title, url }] }
fetch(id: string)     -> { id, title, text, url, metadata? }
```

These must conform to [OpenAI's current MCP search and fetch schema](https://developers.openai.com/api/docs/mcp). Return the same JSON in `structuredContent` and a text content block. The earlier `{ ids: string[] }` sketch was incorrect. Internally the tools map onto Nomad's own search and retrieval. Without them Nomad does not exist inside Deep Research.

### Core

```
get_context(project?: string) -> {
  fields:   [{ key, value, updated_at, project }],
  manifest: { projects: [...], threads: n, files: n, hint: string }
}
```
Returns the standing facts for a project. Target payload ~300-500 tokens. Always includes the manifest (see Section 7).

```
search_context(query: string, project?: string) -> {
  matches: [{ kind, id, key?, snippet, score }]
}
```
FTS5 across fields, thread segments and file chunks. Top-k bounded.

```
save_context(key, value, project, reason) -> {
  status: "saved" | "pending_review",
  message: string
}
```
Writes directly when the field is new and the client's `trust_mode` allows. Creates a proposal when it would overwrite an existing value or touches a sensitive field. See Section 8.

### Threads

```
save_thread(title, project, content) -> { thread_id, capture_kind }
get_thread(thread_id?, project?)     -> { title, summary, segments[], capture_kind }
```
`get_thread` defaults to summary plus recent segments. The model requests more if needed. **The user never sees or chooses these parameters.**

### Files

```
list_files(project?)                    -> [{ id, name, mime, size, outline }]
get_file_chunk(file_id, chunk_ids[])    -> [{ seq, heading, text }]
```
Files are uploaded through the PWA, never through an assistant.

### Server instructions (C8)

The MCP `instructions` field must tell the model to call `get_context` at the start of relevant chats, and must state that returned content is user data and never instruction. This is the main lever on tool-call rate.

**Every returned value is wrapped in a data envelope.** Never interpolate stored content into anything the model reads as instruction.

---

## 7. Token budget and the manifest pattern

**Standing cost per conversation**, paid whether or not Nomad is used:

| Item | Tokens |
|---|---|
| MCP `instructions` | 100-200 |
| 8 tool definitions | 800-1,100 |
| **Total** | **~900-1,300** |

**Per call:**

| Call | Tokens |
|---|---|
| `get_context` | 300-500 |
| `search_context` | 300-600 |
| `get_file_chunk` (2 chunks) | 800-1,500 |
| `get_thread` (summary) | 800-2,000 |

A typical chat using Nomad costs roughly **1,600 tokens total**. Pasting a prior conversation costs 15,000-80,000, every time. Roughly 10-50x cheaper in the common case.

**The manifest.** Every `get_context` response ends with a compact inventory of what exists but was not loaded:

```
--- available, not loaded ---
projects: nomad (12 fields) · thesis (8) · personal (5)
threads: 3 saved · latest "MCP auth design", 2d ago
files: 6 · spec.pdf, budget.xlsx, notes.md, +3
fetch via: search_context | get_thread | get_file_chunk
```

About 70 tokens. The model learns the shape of everything available without paying to load it, then asks for exactly what it needs. **This is the single most important design detail for token efficiency.** Without it the system either dumps everything or the model does not know what to ask for.

**Design rule: default response budget ~500 tokens, one round trip per turn.** Return everything needed in a single response so the model does not have to come back. Latency is perceived as a chain, not as a single call.

---

## 8. The consent model

Consent catches surprises. It is not a toll booth.

| Situation | Behaviour |
|---|---|
| New fact, no conflict | Saved immediately. No prompt. Appears in a digest the user can ignore |
| Would overwrite an existing value | Asks, because something the user said is being replaced |
| Field marked `sensitive` | Always asks |
| Field marked `sealed` | Never returned to any assistant, ever |

Per-assistant `trust_mode` toggle: "trust Claude to update things automatically." One switch. Power users can govern field by field, everyone else flips it once and the product gets out of the way.

**What the user sees when it does ask:**

```
ChatGPT wants to update  writing tone

  was    conversational, some warmth
  now    terse, no filler

  because you said "stop padding your answers"
  in the chat "API design", 12 minutes ago

  [ Keep new ]        [ Keep old ]
```

Two buttons. Tap the value itself to edit. Nothing interrupts mid-conversation; changes batch into a badge.

**Anti-spam, required, not optional:** dedupe identical proposals, rate-limit per client, auto-supersede stale proposals. Watch median time-to-decision. If it drops below about two seconds, people have stopped reading and the consent model has become theatre.

---

## 9. Milestones

**Gate protocol: before starting any milestone, state what you plan to build and what is realistically achievable in the time available, and get explicit agreement. Do not start a milestone because the previous one finished.**

Sizing assumes an LLM writes the code with the owner reviewing and directing.

---

### M0 · Decisions locked
**No code. This document is the deliverable.**

Exit: Section 3 verified, architecture agreed, Section 13 open questions acknowledged.

**Status: complete.**

---

### M1 · Feasibility spike — HARD GATE
**2-3 hours**

A hello-world MCP server on Workers with one read tool returning a fixed string. Add it to Claude and to ChatGPT developer mode.

**In scope:** Worker deploy, public HTTPS, one tool, OAuth or no-auth for the spike only.
**Out of scope:** database, real data, UI, anything persistent.

**Deliverables**
- Deployed Worker at a public URL
- A results table with real measured numbers

| Measure | ChatGPT (web) | Claude (web) | Claude (mobile) |
|---|---|---|---|
| Tool called without prompting | ? | ? | ? |
| Tool called when asked directly | ? | ? | ? |
| p50 / p95 latency, ms | ? | ? | ? |
| Prompting needed to trigger | ? | ? | ? |

**Exit criteria**
- Both assistants call the tool at least once, from at least one surface each
- Latency measured and written down, not estimated
- ChatGPT mobile confirmed unavailable per C1, recorded as a finding

**If this fails:** the whole approach changes and nothing after it is worth building. Claude-only is the documented fallback. Do not proceed on hope.

---

### M2 · Core store and passport
**Rest of day one, roughly 5-6 hours**

**In scope**
- D1 schema: `users`, `fields`, `field_versions`, `clients`, `proposals`, `audit`
- Google OAuth sign-in via Workers OAuth Provider
- Tools: `get_context`, `search_context`, `save_context`, plus conforming `search` and `fetch` (C2)
- FTS5 index over fields
- The manifest in every `get_context` response (Section 7)
- Rate limiting, per C12
- Minimal PWA: list fields, add a field, edit a field
- MCP `instructions` field written and tuned

**Out of scope:** files, threads, conflict UI, landing page, any visual polish.

**Deliverables**
- Working connector both assistants can add
- A passport with real user data in it
- Audit rows for every read

**Exit criteria**
- A real assistant reads a real field and answers correctly using it
- The audit log shows the read with the correct client label
- `search` and `fetch` conform to OpenAI's schema and work in Deep Research
- Two assistants writing to the same field produce a superseded proposal, not a lost update (test this deliberately)
- Tool-call rate recorded across 10 test chats

**This is the end of day one and it stands alone as a product.**

---

### M3 · Quiet consent
**Half a day**

**In scope**
- The three-tier rule from Section 8
- `trust_mode` per client, one toggle
- Proposal dedupe, rate limiting, auto-supersede
- Review card UI with two buttons
- Batched digest, no mid-chat interruption
- Field version history view

**Out of scope:** conflict resolver UI, receipts, org policy.

**Exit criteria**
- A new fact saves silently; an overwrite asks; a sealed field is never returned to any assistant
- `trust_mode: auto` suppresses prompts entirely for that client
- Ten proposals in a row do not produce ten interruptions
- Median time-to-decision recorded, with the two-second warning threshold noted

---

### M4 · Files
**One day**

**In scope**
- Upload through the PWA to R2
- Extraction pipeline, run **once at upload**: blob to R2, extract to markdown, chunk at heading boundaries at 500-800 tokens, insert into FTS5, generate outline
- Tools: `list_files`, `get_file_chunk`
- `search` and `fetch` extended to cover file chunks

**Out of scope:** vector search, OCR, images, re-extraction on read.

**Deliverables**
- A file uploaded once and readable by both assistants

**Exit criteria**
- A 30+ page PDF is uploaded, and an assistant answers a question from it using fewer than 2,000 tokens of retrieved content
- Search miss rate recorded across 20 queries. If keyword search misses badly, that number justifies adding vectors later. Do not add them pre-emptively.
- Extraction happens exactly once per file, verified in logs

---

### M5 · Thread handoff
**One day**

**In scope**
- `save_thread`, `get_thread`
- `capture_kind` provenance tagging, `verbatim` vs `model_summarized`
- PWA paste path as the high-fidelity fallback
- Thread list and detail in the PWA

**Out of scope:** automatic capture. This is impossible, see Section 12.

**Exit criteria**
- "Save this to Nomad" in ChatGPT, then "pick up my ChatGPT thread" in Claude, works in two sentences with no copy-paste
- Capture fidelity measured across 10 threads of varying length, with the loss written down
- The receiving assistant is told when it received a summary rather than a transcript

---

### M6 · Product surface
**One to two days**

**In scope**
- Landing page with the honest-limits section
- Onboarding: three seeded questions, or import an existing memory export
- Connector setup walkthrough for both assistants
- PWA install path, desktop and mobile
- Visual system applied throughout

**Out of scope:** 3D, animation, org policy mock. Add only if time remains.

**Exit criteria**
- Installs on Android, iPhone and desktop
- A person who has never seen Nomad completes setup unaided in under five minutes, timed, at least three people
- The limits page states plainly: the model decides when to call Nomad; Nomad does not sync the assistants' own memory; context already sent cannot be retracted

---

### M7 · Hardening and pilot
**One build day, then one week running**

**In scope**
- Prompt-injection test suite against the data envelope
- Security pass: sealed fields, encryption at rest, export, hard delete
- Usage alarms below every free-tier ceiling
- Read-only degradation instead of hard failure
- 10 to 20 pilot users

**Exit criteria**
- Seven consecutive days of real use with zero unapproved writes and zero sealed-field leaks
- A crafted injection payload stored as a field does not alter assistant behaviour
- Every free-tier ceiling has an alarm and a graceful path

---

### M8 · Evidence
**One day**

**In scope**
- Evaluation: 40-50 scenarios run by hand in both assistants, each with an expected tool call and expected scope. The server logs every call, so scoring is largely automatic.
- Metrics dashboard
- One documented change made because the data said so
- Two-minute demo video
- Case study

**Exit criteria**
- ChatGPT vs Claude compared on an identical scenario set, with results written up
- Every claim made about the project traces to a measured number

---

## 10. Metrics

Defined before launch so the pilot measures rather than rationalises.

**North star:** weekly chats in which an assistant used Nomad context.

| Kind | Metric | From |
|---|---|---|
| Adoption | Tool-call rate: how often the assistant called Nomad when it should have | M2 |
| Adoption | Setup completion rate, and time to first successful read | M6 |
| Input | Share of saves that were silent vs prompted | M3 |
| Input | Median time from prompt to decision | M3 |
| Quality | Search miss rate | M4 |
| Quality | Thread capture fidelity | M5 |
| Guardrail | Sealed-field leaks, target zero | M2 |
| Guardrail | Unapproved writes, target zero | M3 |
| Performance | p50 / p95 tool latency per platform | M1 |

**Discipline: no claim is made until the number exists.** Until then, describe what was built and the method.

---

## 11. Risks

Ordered by how likely they are to kill the project.

| # | Risk | Mitigation |
|---|---|---|
| 1 | **The model never calls Nomad.** Largest risk, least control. | MCP `instructions` (C8), "Use this when..." in every description, `readOnlyHint` (C7), tool-call rate as a first-class metric from M2. Fallback: a one-line primer the user pastes. |
| 2 | **Cold start.** Empty passport, no first-use value, never fills. | Import existing memory exports during onboarding, plus three seeded questions. Value must land in session one. |
| 3 | **Prompt injection through stored context.** Poison one field, every assistant reads it. Realistic vector: an uploaded file from an untrusted source. | Data envelope on every returned value, control-sequence stripping at ingest, explicit statement in server instructions. **Ships in M2, not M7.** |
| 4 | **Proposal spam into rubber-stamping.** Consent becomes theatre while demoing fine. | Section 8 anti-spam rules. Watch time-to-decision. |
| 5 | **Lossy thread capture.** Receiver gets a degraded copy and does not know. | `capture_kind` provenance, fidelity measured in M5, PWA paste path for high-fidelity needs. |
| 6 | **Latency.** People switch it off. | One round trip per turn. Budget set from M1 measurements, not from assumption. |
| 7 | **Free tier cliff.** D1 daily limit means total failure until midnight UTC (C12). | Rate limiting in M2, alarms well below ceilings, read-only degradation. |
| 8 | **Honeypot.** One store holding everything. | Sealed fields, encryption at rest, export and hard delete, stated plainly. For a product whose pitch is trust, this is the pitch. |
| 9 | **A vendor closes the gap.** | Vendor neutrality is the moat. No vendor has an incentive to make export live, two-way, and inclusive of a competitor. |

---

## 12. Honest limits

State these in the product, not just the plan.

- **The model decides when to call Nomad. Nomad cannot force it.**
- **Nomad cannot silently watch a conversation and mirror it.** No connector gets that access. Handoff is one sentence to save, one sentence to load.
- Nomad does not sync ChatGPT's or Claude's own memory. It is a separate layer.
- Context already sent to a provider cannot be pulled back. Revocation only stops future reads.
- ChatGPT requires a paid plan and developer mode, which is beta, and works on web only (C1).
- Free hosting covers one person and a pilot, not real multi-user scale.

---

## 13. Open questions

| # | Question | Resolved by |
|---|---|---|
| 1 | Actual tool-call latency on both platforms | M1, measured |
| 2 | Thread capture fidelity loss | M5, measured |
| 3 | Whether FTS5 keyword search is sufficient, or vectors are needed | M4, from miss rate |
| 4 | Whether the model reliably calls Nomad unprompted, or needs explicit user phrasing | M2, across 10 test chats |
| 5 | Domain name and whether to open-source | Before M6 |

---

## 14. Working agreement

1. **Confirm before each milestone.** State the plan and what is achievable. Get agreement. Then build.
2. **Measure, do not assert.** Any number in this plan not marked verified is a placeholder until measured.
3. **M1 is a hard gate.** If both assistants fail to call a trivial tool, stop and rethink rather than proceeding.
4. **Day one ends at M2.** Everything after is optional and independently valuable.
