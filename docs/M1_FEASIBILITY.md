# M1: assistant connection feasibility

**Status: M1 web exit criteria met, 18 September 2026 UTC.** The deployed Worker passes MCP protocol checks. ChatGPT web and Claude web made live calls, and each produced 20 timed, successful responses. Claude mobile remains untested.

## Scope verdict

The existing Worker is valid for [the current build plan](BUILD_PLAN.md): it has a public HTTPS /mcp endpoint, one read-only diagnostic tool, no authentication, no database, no personal data, and no persistence. Its fresh request ID and UTC time are stronger proof of a live call than a fixed hello-world string alone. No provider model API key is used.

This is a transport spike, not evidence that Nomad context is useful or that an assistant will call a future context tool reliably. The earlier enterprise PRD is a separate scope: personal-account tests do not prove an administrator can approve this connector in a managed workspace. Test that separately before any enterprise claim.

## Evidence so far

| Check | Result |
| --- | --- |
| TypeScript type check | Passed again, 18 September 2026 UTC |
| Local MCP initialize, tools/list, and tools/call | Passed, 18 September 2026 UTC |
| Read-only annotation, fresh request IDs, invalid challenge | Passed locally and publicly |
| Public HTTPS health and MCP protocol | Passed again, 18 September 2026 UTC |
| Local HTTP tool-call latency | p50 4.8 ms, p95 13.3 ms, 20 sequential calls from this machine |
| Public HTTP tool-call latency | Latest check: p50 32.3 ms, p95 35.9 ms, 20 sequential calls from this machine; first check: p50 37.4 ms, p95 53.7 ms |
| User-reported assistant outputs | Four distinct valid request IDs and increasing UTC times, two each from ChatGPT web and Claude web |
| ChatGPT web actual tool call | Owner saw nomad_probe for natural and direct prompts; an automated signed-in browser run also showed the Nomad work trace and 20 fresh results |
| Claude web actual tool call | Owner saw nomad_probe for natural and direct prompts; an automated signed-in browser run showed the Nomad tool card on all 20 timed results |
| ChatGPT web send-to-visible-result latency | p50 8,971 ms, p95 10,794 ms, 20 successful calls |
| Claude web send-to-visible-result latency | p50 7,806 ms, p95 19,992 ms, 20 successful calls, including single-use approval time |
| Claude web approval-to-visible-result latency | p50 2,872 ms, p95 3,384 ms, the same 20 calls |
| Claude mobile actual tool call | Not tested |

The deployed diagnostic URL is https://nomad-mcp-feasibility.nomad-mcp-feasibility.workers.dev/mcp. It must remain data-free. Deployed Worker version 95f0a3df-adad-4428-9b0a-5f1bdff599f4 passed the latest public protocol check with request ID 987e9c82-9fc6-4dfc-b625-8bca8edd37b2 at 2026-09-18T04:44:24.486Z. This was an automated MCP client, **not** ChatGPT or Claude. HTTP latency is a network baseline, separate from the assistant UI timings.

## User-reported assistant results

The owner reported these four results after deployment and identified results 1 and 3 as ChatGPT web, and 2 and 4 as Claude web. The owner saw nomad_probe in the actual tool-call view in both products. Results 3 and 4 came from natural prompts that did not name the tool; 1 and 2 came from direct prompts. The UUIDs are distinct and well formed, and the UTC times increase. A later signed-in browser session reproduced live calls on both web clients.

| Result | Request ID | Reported server time (UTC) | Client and tool-call evidence |
| --- | --- | --- | --- |
| 1 | 4f353363-f92d-4bcf-b3ce-83abf4eccc3a | 2026-09-18T01:32:56.469Z | ChatGPT web, direct prompt, visible tool call |
| 2 | 09cf1763-1aa6-488d-b7b8-8bec76b6a6e3 | 2026-09-18T01:33:33.878Z | Claude web, direct prompt, visible tool call |
| 3 | b65986ad-97e1-4a89-a993-978c31ae8225 | 2026-09-18T01:34:46Z | ChatGPT web, natural prompt, visible tool call; assistant reported challenge echo |
| 4 | 609bc022-9db3-4027-9464-3a4d53438a66 | 2026-09-18T01:35:15.289Z | Claude web, natural prompt, visible tool call |

## Assistant results

| Measure | ChatGPT web | Claude web | Claude mobile |
| --- | --- | --- | --- |
| Tool called for a natural connection question, without naming the tool | Yes; result 3, owner observed tool call | Yes; result 4, owner observed tool call | Pending |
| Tool called when nomad_probe is named directly | Yes; result 1, owner observed tool call | Yes; result 2, owner observed tool call | Pending |
| Send-to-visible-result p50 / p95, ms | 8,971 / 10,794 | 7,806 / 19,992, including single-use approval | Not tested |
| Approval-to-visible-result p50 / p95, ms | No approval prompt in these runs | 2,872 / 3,384 | Not tested |
| Prompt wording needed to trigger the call | Natural and direct prompts worked; timed runs explicitly selected Nomad and requested `nomad_probe` | Natural and direct prompts worked; repeated checks in one chat eventually led Claude to reuse prior status or refuse another call. Explaining the bounded benchmark and opening fresh chats restored fresh calls. | Not tested |

ChatGPT developer mode is [documented as web-only](https://developers.openai.com/api/docs/guides/developer-mode); ChatGPT mobile is unavailable for this test, not a failed Worker call.

### Timed browser runs

The [raw client measurements](M1_CLIENT_LATENCY.csv) contain the challenge, request ID, server time, and elapsed milliseconds for all 40 accepted calls. They were collected on 18 September 2026 UTC in signed-in browser sessions: ChatGPT web used GPT-5.6 Sol Light and Claude web used Sonnet 5 High. Each direct prompt carried a unique challenge. ChatGPT's Nomad app was selected in the composer. Claude's Nomad connector was enabled and each call used **Allow once**; persistent **Always allow** permission was rejected by automatic approval review because this is a bounded test.

An in-page `performance.now()` clock started on the trusted Send click. A 50 ms page poller stopped when a new request ID and server time were both visible. Claude also recorded the first permission prompt and the effective **Allow once** click. The reported percentile is nearest rank: sort 20 values and take the 10th for p50 and 19th for p95. Each accepted response had a distinct UUID and parseable UTC server time. Claude displayed a Nomad tool card on every accepted call; a ChatGPT work trace was expanded to verify the tool invocation.

These numbers are **UI response times**, not MCP network round-trip times. Claude's send-to-result measure includes model time and the single-use approval delay, including browser automation overhead. Its approval-to-result measure begins at the permission click and still includes any assistant rendering or response generation. The two clients' send-to-result figures should not be treated as a clean speed comparison. The public HTTP baseline above isolates the Worker path more closely.

Some attempted calls were excluded from the 20-sample latency sets. A ChatGPT result was missed by an early timer that counted visible replies; the chat had removed an older reply as it grew, so the timer was changed to detect a previously unseen UUID. One ChatGPT composer focus error sent only the app mention. Claude declined fresh calls after repeated identical checks in one chat, and again after interpreting challenge numbers as sample counts. Another Claude run had a delayed permission click. These are recorded as trigger and test-harness findings, not successful latency samples. Fresh Claude chats and a clear, bounded benchmark explanation were needed to complete the 20 successful calls.

| Excluded attempt | Outcome and reason |
| --- | --- |
| ChatGPT, mention-only message | Composer focus error sent no challenge. This is a harness error. |
| ChatGPT, `chatgpt-browser-check-005` | Live result `121bf569-4f5a-4961-b5b8-e13099d97d98`, but the first timer missed it when an older message left the visible page. |
| Claude, `claude-browser-check-006` | No tool call; Claude reused prior status after repeated checks in one chat. |
| Claude, `claude-browser-check-008` | Live result `10c2892b-4698-4d3b-8780-e36d84cecbfb`, but the first permission click did not take and the run waited about a minute before a retry. |
| Claude, first `claude-browser-check-021` and `-023` prompts | No tool call; Claude questioned the repeated benchmark. Clarifying the remaining count and then using a fresh chat produced live calls. |

Earlier pilot calls also established the browser flow but were not included in the percentile sets.

## How to run M1 end to end

1. With Node 22 or newer and dependencies installed, run `pnpm typecheck` in `apps/mcp-worker`, then set `NOMAD_MCP_URL` to the public `/mcp` URL and run `pnpm test:mcp`. The script checks initialization, tool discovery, read-only metadata, 20 fresh tool calls, invalid input, and HTTP p50/p95. This proves the endpoint, not assistant integration. This session reran the type check through `node_modules/.bin/tsc --noEmit` because its bundled pnpm wrapper wanted to reinstall the existing `node_modules` in a noninteractive shell.
2. In ChatGPT **web**, enable Developer mode under Settings → Security and login. Create a developer-mode app for the /mcp URL and choose **No authentication/None** for this data-free spike. In a new conversation, select the app from the Developer mode tools menu. Refresh any existing app after this deployment so it loads the latest tool description. If setup fails, record the exact error. Selecting OAuth will fail because this Worker has no OAuth routes. [ChatGPT setup guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).
3. In Claude **web**, go to Customize → Connectors → + → Add custom connector, enter the same URL, and enable it for the conversation through + → Connectors. Then use the same connector from Claude mobile, if it appears. For Team/Enterprise, an Owner must first add it under Organization settings → Connectors. Refresh or reconnect any existing app so the client loads the latest tool description. [Claude setup guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
4. On each surface, first ask: **“Use nomad_probe with challenge M1 connection check. Report the request ID and server time exactly.”** Inspect the expanded tool call, not just the assistant's prose. A real result contains a fresh UUID and UTC timestamp.
5. Start a fresh conversation and ask a natural question without naming the tool: **“Can you verify that my Nomad connection is working right now? Include the live server time.”** Record whether the tool was called and the wording that worked. Repeat direct and natural cases across fresh conversations so prior prompts do not bias the result.
6. For client latency, collect at least 20 successful direct calls per surface. Measure from Send to the full visible result with a browser clock or screen recording; if the UI exposes tool-call start and result timestamps, that is a separate measure. Record any permission prompt and approval click separately. Use one definition consistently, sort the 20 values, and report the 10th as p50 and 19th as p95. Record the prompt, surface, call/no-call, request ID, server time, and elapsed milliseconds for **every attempt**, including excluded attempts. The accepted measurements from this run are in [M1_CLIENT_LATENCY.csv](M1_CLIENT_LATENCY.csv).

Do not enter personal data into the challenge or add context storage to this unauthenticated endpoint. Google Gemini was explored earlier, but it is not an M1 exit requirement in the current build plan.

## Go / no-go

**M1 web gate: pass.** ChatGPT web and Claude web each invoked the live tool in a real conversation, 20 successful latency measurements per web client are recorded, natural and direct trigger results are documented, and ChatGPT mobile's web-only limitation is recorded. Claude mobile is still an untested cell in the plan's results table, but is not an M1 exit criterion. The repeated-call refusals in one Claude conversation are a real model-behavior risk to test again with the useful context tools in M2.
