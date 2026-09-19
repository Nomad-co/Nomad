# M2 validation · 18 September 2026

**Status: one client check remains.** The isolated M2 Worker is deployed at `https://nomad-core.nomad-mcp-feasibility.workers.dev/mcp`. All core hosted flows passed in ChatGPT and Claude. A ChatGPT Deep Research-mode run remains; regular ChatGPT Work mode already passed the same `search`/`fetch` contract. The original M1 `/health` still reports `M1-connectivity-test`.

| Check | Result | Evidence |
|---|---|---|
| D1 schema and FTS5 | Pass | Local and remote migration `0001_core.sql` applied. |
| TypeScript | Pass | `tsc --noEmit`. |
| Store and passport integration | Pass | 2 tests: user isolation, sealed exclusion, audit hashes and labels, two conflicting proposals with one superseded, version history, stale edit, CSRF, add/edit/sign-out. |
| OAuth and MCP transport, local | Pass | Disposable local session; DCR client registration, consent, PKCE code exchange, token with read/write scope, MCP initialization and five-tool listing. `save_context`, `get_context`, `search_context`, `search`, and `fetch` returned expected data. Deep Research tool results include both `structuredContent` and matching text content. Audit page showed the user-chosen client label on each read. |
| Public Worker protection | Pass | M2 `/health` returned 200; unauthenticated `/mcp` returned 401 with bearer resource metadata. |
| Google sign-in | Pass | Google Cloud project `nomad-509012`; external testing consent screen; signed-in account added as a test user; web origin and callback match the Worker; credentials stored as Worker secrets; live `/health` returned `googleConfigured:true`; Google authorization-code flow returned to the authenticated passport. |
| Live passport seed | Pass | Added synthetic `personal / writing_style = concise, direct` as normal and `personal / test_secret = amber-owl-728` as sealed through the deployed passport UI. The collision test later changed `writing_style` to `plain language`; the sealed marker remains unchanged. |
| ChatGPT M2 read | Pass | `Nomad Passport` was added alongside the M1 probe. Hosted calls returned the saved value; the sealed marker search returned no result; the audit page recorded labeled `get_context`, `search_context`, `search`, and `fetch` calls. |
| Claude M2 read | Pass | Claude discovered all five tools. After the plan window reset, it returned `concise, direct` through `search_context`; the audit page recorded the read under the `Claude` label. |
| Hosted `search` / `fetch` | Pass outside Deep Research | Both clients searched for `writing_style`, fetched id `9bc494b8-3099-44c0-9af7-d2a1fda0a450`, and displayed title `personal / writing_style`, text `concise, direct`, and the field URL. Both returned an empty search result for sealed marker `amber-owl-728`. ChatGPT Deep Research mode remains unverified. |
| Proposal collision | Pass | ChatGPT proposed `plain language` and Claude proposed `short paragraphs` from base version 1. Live D1 verification showed ChatGPT `applied`, Claude `superseded`, field version 2 with value `plain language`, and exactly two history rows total, so only one new version was created. |
| Ten-chat tool-call rate | Recorded | ChatGPT web, ten fresh Work chats with `Nomad Passport` selected: natural prompts 0/5; direct prompts 4/5. Tool descriptions were refreshed and retested; natural selection remained 0/5. Visible responses were cross-checked against labeled audit rows. A separate Claude ten-chat measurement was started but stopped because it was unnecessary for the build-plan criterion and consumed excessive hosted-client usage. |

The local OAuth run used synthetic values and a short-lived session written only to local KV. No test authentication route was deployed. The live passport contains only the synthetic acceptance-test values listed above. The [M2 setup and acceptance guide](../apps/nomad-worker/README.md) gives the remaining Deep Research step and exact test prompt.
