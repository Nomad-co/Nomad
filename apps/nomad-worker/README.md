# Nomad M2–M8 Worker

This Worker is separate from the public, data-free M1 probe. Its MCP route is `https://nomad-core.nomad-mcp-feasibility.workers.dev/mcp`. It owns the passport UI, Google sign-in, OAuth protected MCP tools, D1 and R2 storage, FTS5 search, file extraction, thread handoff, evaluation, and read audit.

## Current state

- Deployed Worker, D1 schema, and KV namespace exist.
- Local D1 integration tests pass. A disposable local session completed OAuth registration, consent, PKCE token exchange, protected MCP initialization, all five M2 tools, and a labeled read audit. Live `/health`, OAuth metadata, and unauthorized MCP behavior were checked.
- Google sign-in is configured in Google Cloud project `nomad-509012`. The external consent screen is in testing mode, the test account is allowed, the web client uses the exact deployed origin and callback, and both credentials are stored as Worker secrets.
- The deployed `/health` reports `googleConfigured:true`, and a live Google authorization-code login returned to the authenticated Nomad passport. The passport contains the two synthetic fields used by the acceptance test.
- M2 client acceptance is nearly complete. ChatGPT and Claude real reads, sealed-field exclusion, labeled audit rows, hosted `search`/`fetch`, and the proposal collision passed. ChatGPT's ten-chat trigger measurement is recorded. A ChatGPT Deep Research-mode run remains; ordinary Work mode already exercised the conforming `search` and `fetch` tools.
- M3–M8 code and migrations are implemented. The local suite covers trusted writes, proposal batching, PDF and text extraction, file search, cross-client thread handoff, public product routes, injection boundaries, export, full access revocation and deletion, usage degradation, and evaluation scoring.
- Production migration `0002_milestones.sql` is applied. Cloudflare R2 is enabled, the `nomad-files` Standard bucket exists, and M3–M8 Worker version `85fefd21-25e4-4337-8020-e6a2ad469a61` is deployed.

## Google setup

1. In the signed-in Google Cloud account, finish two-step verification and accept the Cloud terms.
2. Create or select a Google Cloud project for Nomad. Configure the OAuth consent screen as an external app in testing mode. Add your Google account as a test user.
3. Create an OAuth **Web application** client. Use the exact authorized redirect URI `https://nomad-core.nomad-mcp-feasibility.workers.dev/auth/google/callback` and authorized JavaScript origin `https://nomad-core.nomad-mcp-feasibility.workers.dev`.
4. From this directory, set the two Worker secrets through Wrangler's interactive prompts. Do not put the client secret in chat, source code, or a committed file:

   ```sh
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   ```

5. Check `/health` reports `googleConfigured: true`. The Google OAuth client and callback must match exactly. Sign in at the Worker root URL.

The Google code flow verifies the ID token signature, issuer, audience, expiry, nonce, and verified email. The PWA uses an opaque `HttpOnly`, `SameSite=Lax`, secure cookie. OAuth client labels are chosen by the user on the consent page, then appear on each audit row. No Google refresh or access token is stored.

## Local checks

Use Node 24 or later, then run in this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
wrangler d1 migrations apply nomad-core --local
pnpm test
wrangler dev --local --port 8788 --var PUBLIC_ORIGIN:http://127.0.0.1:8788
```

The suite uses local D1, KV, and R2 bindings. It covers cross-user isolation, sealed-field exclusion, read audits, proposal conflicts, quiet consent, file extraction and search, thread handoff, product routes, injection handling, export, OAuth and session revocation, hard deletion, usage degradation, evaluation scoring, and stale passport edits.

## M3–M8 deployment

R2 is enabled in production. To deploy a later revision, run:

```sh
wrangler r2 bucket create nomad-files
wrangler d1 migrations apply nomad-core --remote
wrangler deploy
```

The D1 migration is idempotently tracked by Wrangler and is already applied in the current account. Application counters are conservative guardrails; Cloudflare account alerts must also be enabled before the M7 pilot.

With `wrangler dev` running, check:

- `GET /health` returns 200.
- `GET /` redirects to `/login` without a session.
- `GET /mcp` returns 401 with an OAuth bearer challenge.
- `GET /.well-known/oauth-protected-resource/mcp` returns the canonical M2 resource URL.

Local Google login requires a separate redirect URI on the Google web client and local `.dev.vars` values. The full downstream OAuth/MCP flow was also checked locally with a disposable session placed in local KV; no test login route exists in the Worker. The deployed Google callback and authenticated passport login have been verified.

## M2 acceptance test after Google setup

1. Sign in to the passport. Add `personal / writing_style = concise, direct` as a normal field. Add a synthetic sealed field such as `personal / test_secret = amber-owl-728`.
2. Add the M2 MCP URL in ChatGPT web and Claude web. In each consent page, personally label the client `ChatGPT` or `Claude`. Allow the advertised read and write scopes.
3. In each assistant, ask for your writing style. Confirm it invokes `get_context` and answers with `concise, direct`. Check `/audit` for a `get_context` read with that assistant's label.
4. Ask each assistant to search for `writing_style`, then fetch the returned id. Confirm the full value and citation URL. Ask for `amber-owl-728` and confirm no tool returns the sealed field.
5. Ask ChatGPT to update `writing_style` to `plain language`; ask Claude to update it to `short paragraphs` before approving either proposal. The passport should show two pending changes. Approve one, then the other. Confirm the first value remains, the second proposal is `superseded`, and history has exactly one new version.
6. Run a Deep Research chat that uses `search` and `fetch`. Inspect the tool results for `{results:[{id,title,url}]}` and `{id,title,text,url,metadata}`. Confirm the response cites the fetched field. Deep Research availability depends on the client account and UI.
7. Open ten fresh chats on the client surface being measured: five with a natural context question and five explicitly asking it to consult Nomad. Record how many chats invoke Nomad without naming the tool, plus direct invocation rate. Use the audit log and visible tool cards to cross-check; report each denominator and client surface. Repeat on another client only when a separate per-client rate is needed.

M2 passes only when both assistants read real data, audit labels are correct, `search`/`fetch` work in Deep Research, the collision produces a superseded proposal, and the ten-chat trigger rate is recorded. The rate limit binding is deliberately small for the pilot: 12 calls per user and 20 total per Cloudflare location per minute. [Cloudflare documents](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) that these counters are eventually consistent and regional, so they are a guardrail rather than exact daily accounting.
