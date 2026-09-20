import assert from "node:assert/strict";
import test from "node:test";
import { getPlatformProxy } from "wrangler";
import { verifyForm } from "../src/auth.ts";
import { applyProposal, fetchField, getContext, saveContext, searchFields, updateFieldFromPassport } from "../src/store.ts";
import { handleApp } from "../src/ui.ts";
import type { Env } from "../src/types.ts";

test("embedded OAuth consent accepts an opaque origin without weakening other forms", () => {
  const session = { userId: crypto.randomUUID(), csrf: "known-token" };
  const form = new FormData();
  form.set("csrf", session.csrf);
  const embeddedRequest = new Request("https://nomad.example/consent", { method: "POST", headers: { Origin: "null" } });
  assert.equal(verifyForm(embeddedRequest, session, form), false);
  assert.equal(verifyForm(embeddedRequest, session, form, true), true);
  form.set("csrf", "wrong-token");
  assert.equal(verifyForm(embeddedRequest, session, form, true), false);
});

test("Gemini consent permits its OAuth return and remains retryable after provider failure", async () => {
  const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", remoteBindings: false });
  const env = proxy.env;
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const ticket = crypto.randomUUID();
  const csrf = crypto.randomUUID();
  const oauthClientId = crypto.randomUUID();
  const consentKey = `nomad:consent:${ticket}`;
  const oauthRequest = {
    responseType: "code",
    clientId: oauthClientId,
    redirectUri: "https://oauth-redirect.googleusercontent.com/r/nomad-test",
    scope: ["mcp:read", "mcp:write"],
  };
  try {
    await env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)")
      .bind(userId, `test-${userId}`, "gemini@example.test").run();
    await env.OAUTH_KV.put(`nomad:session:${token}`, JSON.stringify({ userId, csrf }));
    await env.OAUTH_KV.put(consentKey, JSON.stringify({ userId, request: oauthRequest }));
    env.OAUTH_PROVIDER = {
      async lookupClient() { return { clientName: "Gemini" }; },
      async completeAuthorization() { throw new Error("provider unavailable"); },
    } as unknown as Env["OAUTH_PROVIDER"];

    const cookie = `__Host-nomad_session=${token}`;
    const page = await handleApp(new Request(`https://nomad.example/consent?ticket=${ticket}`, { headers: { Cookie: cookie } }), env);
    assert.match(page.headers.get("Content-Security-Policy") ?? "", /form-action 'self' https:\/\/oauth-redirect\.googleusercontent\.com/);
    await assert.rejects(handleApp(new Request("https://nomad.example/consent", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "null", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf, ticket, label: "Gemini" }),
    }), env), /provider unavailable/);
    assert.ok(await env.OAUTH_KV.get(consentKey));
  } finally {
    await proxy.dispose();
  }
});

test("M2 store enforces ownership, sealed visibility, audit, and conflicting proposals", async () => {
  const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", remoteBindings: false });
  const env = proxy.env;
  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  const chatgptId = crypto.randomUUID();
  const claudeId = crypto.randomUUID();
  const otherClientId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)").bind(userId, `test-${userId}`, "a@example.test"),
      env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)").bind(otherUserId, `test-${otherUserId}`, "b@example.test"),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?)").bind(chatgptId, userId, "ChatGPT", `test-${chatgptId}`),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?)").bind(claudeId, userId, "Claude", `test-${claudeId}`),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?)").bind(otherClientId, otherUserId, "Other", `test-${otherClientId}`),
    ]);
    const chatgpt = { userId, clientId: chatgptId };
    const claude = { userId, clientId: claudeId };
    const other = { userId: otherUserId, clientId: otherClientId };
    const saved = await saveContext(env, chatgpt, { project: "nomad", key: "timezone", value: "Chicago Central Time", reason: "test" });
    assert.equal(saved.status, "saved");
    const fieldId = saved.field_id!;

    const context = await getContext(env, chatgpt);
    assert.equal(context.fields[0].value, "Chicago Central Time");
    assert.equal((await getContext(env, other)).fields.length, 0);
    assert.equal((await searchFields(env, claude, "Chicago")).length, 1);
    assert.equal((await searchFields(env, other, "Chicago")).length, 0);
    assert.equal((await fetchField(env, claude, fieldId))?.value, "Chicago Central Time");
    assert.equal(await fetchField(env, other, fieldId), null);

    const sealedId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO fields(id,user_id,project,key,value,sensitivity) VALUES(?,?,?,?,?,'sealed')")
      .bind(sealedId, userId, "nomad", "secret", "do-not-share-99381").run();
    assert.equal((await getContext(env, chatgpt)).fields.some((field) => field.id === sealedId), false);
    assert.equal((await searchFields(env, chatgpt, "do-not-share-99381")).length, 0);
    assert.equal(await fetchField(env, chatgpt, sealedId), null);

    const first = await saveContext(env, chatgpt, { project: "nomad", key: "timezone", value: "Chicago CDT", reason: "update one", idempotency_key: "first" });
    const second = await saveContext(env, claude, { project: "nomad", key: "timezone", value: "Chicago CST", reason: "update two", idempotency_key: "second" });
    assert.equal(first.status, "pending_review");
    assert.equal(second.status, "pending_review");
    assert.equal((await fetchField(env, chatgpt, fieldId))?.value, "Chicago Central Time");
    assert.equal(await applyProposal(env, userId, first.proposal_id!), "applied");
    assert.equal(await applyProposal(env, userId, second.proposal_id!), "superseded");
    const field = await env.DB.prepare("SELECT value,version FROM fields WHERE id=?").bind(fieldId).first<{ value: string; version: number }>();
    assert.deepEqual(field, { value: "Chicago CDT", version: 2 });
    const history = await env.DB.prepare("SELECT value FROM field_versions WHERE field_id=? ORDER BY created_at,rowid").bind(fieldId).all<{ value: string }>();
    assert.equal(history.results.length, 2);
    const statuses = await env.DB.prepare("SELECT status FROM proposals WHERE id IN (?,?) ORDER BY id").bind(first.proposal_id, second.proposal_id).all<{ status: string }>();
    assert.deepEqual(statuses.results.map((row) => row.status).sort(), ["applied", "superseded"]);

    assert.equal(await updateFieldFromPassport(env, userId, { id: fieldId, version: 1, project: "nomad", key: "timezone", value: "bad stale write", sensitivity: "normal" }), false);
    const audit = await env.DB.prepare("SELECT a.action,a.value_hash,c.label FROM audit a JOIN clients c ON c.id=a.client_id WHERE a.user_id=? ORDER BY a.created_at")
      .bind(userId).all<{ action: string; value_hash: string; label: string }>();
    assert.ok(audit.results.some((row) => row.label === "Claude" && row.action === "fetch"));
    assert.ok(audit.results.every((row) => /^[0-9a-f]{64}$/.test(row.value_hash)));
    assert.equal(JSON.stringify(audit.results).includes("Chicago Central Time"), false);
  } finally {
    await proxy.dispose();
  }
});

test("passport forms enforce session and CSRF, then add, edit, and sign out", async () => {
  const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", remoteBindings: false });
  const env = proxy.env;
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const csrf = crypto.randomUUID();
  const origin = "http://localhost:8788";
  const headers = { Cookie: `nomad_session=${token}`, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" };
  const post = (path: string, values: Record<string, string>) => new Request(`${origin}${path}`, {
    method: "POST", headers, body: new URLSearchParams(values),
  });
  try {
    const clientId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)")
        .bind(userId, `test-${userId}`, "passport@example.test"),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?)")
        .bind(clientId, userId, "ChatGPT", `test-${clientId}`),
    ]);
    await env.OAUTH_KV.put(`nomad:session:${token}`, JSON.stringify({ userId, csrf }), { expirationTtl: 600 });
    const unauthenticated = await handleApp(new Request(origin), env);
    assert.equal(unauthenticated.status, 303);
    assert.equal(unauthenticated.headers.get("Location"), `${origin}/login`);
    const passport = await handleApp(new Request(origin, { headers: { Cookie: `nomad_session=${token}` } }), env);
    const passportPage = await passport.text();
    assert.match(passportPage, /aria-describedby="project-help"/);
    assert.match(passportPage, /you do not need to find them on another website/);
    assert.match(passportPage, /If you are unsure, keep “personal.”/);
    assert.match(passportPage, /You make this name yourself/);
    assert.match(passportPage, /Type it in your own words or copy it from your notes/);
    assert.match(passportPage, /Sealed never shares it with an assistant/);
    const invalid = await handleApp(post("/fields/new", { csrf: "wrong", project: "personal", key: "voice", value: "calm", sensitivity: "normal" }), env);
    assert.equal(invalid.status, 403);
    const added = await handleApp(post("/fields/new", { csrf, project: "personal", key: "voice", value: "calm", sensitivity: "normal" }), env);
    assert.equal(added.status, 303);
    const field = await env.DB.prepare("SELECT * FROM fields WHERE user_id=? AND key='voice'").bind(userId).first<{ id: string; version: number }>();
    assert.ok(field);
    const edited = await handleApp(post("/fields/edit", { csrf, id: field.id, version: "1", project: "personal", key: "voice", value: "plain", sensitivity: "sealed" }), env);
    assert.equal(edited.status, 303);
    const visible = await handleApp(new Request(`${origin}/field/${field.id}`, { headers: { Cookie: `nomad_session=${token}` } }), env);
    assert.equal(visible.status, 200);
    const fieldPage = await visible.text();
    assert.match(fieldPage, /plain/);
    assert.match(fieldPage, /Version history/);
    assert.match(fieldPage, /calm/);
    const trusted = await handleApp(post("/clients/trust", { csrf, id: clientId, trust_mode: "auto" }), env);
    assert.equal(trusted.status, 303);
    const client = await env.DB.prepare("SELECT trust_mode FROM clients WHERE id=?").bind(clientId).first<{ trust_mode: string }>();
    assert.equal(client?.trust_mode, "auto");
    const signedOut = await handleApp(post("/logout", { csrf }), env);
    assert.equal(signedOut.status, 303);
    const after = await handleApp(new Request(origin, { headers: { Cookie: `nomad_session=${token}` } }), env);
    assert.equal(after.status, 303);
  } finally {
    await proxy.dispose();
  }
});

test("M3 auto trust applies overwrites without review and records history", async () => {
  const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", remoteBindings: false });
  const env = proxy.env;
  const userId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)").bind(userId, `test-${userId}`, "auto@example.test"),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id,trust_mode) VALUES(?,?,?,?,'auto')")
        .bind(clientId, userId, "Trusted", `test-${clientId}`),
    ]);
    const identity = { userId, clientId };
    const created = await saveContext(env, identity, { project: "personal", key: "tone", value: "direct", reason: "seed" });
    const updated = await saveContext(env, identity, { project: "personal", key: "tone", value: "plain", reason: "explicit update" });
    assert.equal(created.status, "saved");
    assert.equal(updated.status, "saved");
    const field = await env.DB.prepare("SELECT value,version FROM fields WHERE id=?").bind(created.field_id).first<{ value: string; version: number }>();
    assert.deepEqual(field, { value: "plain", version: 2 });
    const versions = await env.DB.prepare("SELECT value FROM field_versions WHERE field_id=? ORDER BY created_at,rowid")
      .bind(created.field_id).all<{ value: string }>();
    assert.deepEqual(versions.results.map((row) => row.value), ["direct", "plain"]);
  } finally {
    await proxy.dispose();
  }
});

test("M3 repeated proposals for one field collapse into one review item", async () => {
  const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", remoteBindings: false });
  const env = proxy.env;
  const userId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,google_sub,email) VALUES(?,?,?)").bind(userId, `test-${userId}`, "digest@example.test"),
      env.DB.prepare("INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?)")
        .bind(clientId, userId, "ChatGPT", `test-${clientId}`),
    ]);
    const identity = { userId, clientId };
    await saveContext(env, identity, { project: "personal", key: "tone", value: "direct", reason: "seed" });
    for (let index = 0; index < 10; index += 1) {
      await saveContext(env, identity, {
        project: "personal", key: "tone", value: `revision ${index}`, reason: "digest test", idempotency_key: `revision-${index}`,
      });
    }
    const pending = await env.DB.prepare("SELECT proposed_value FROM proposals WHERE user_id=? AND status='pending'")
      .bind(userId).all<{ proposed_value: string }>();
    assert.deepEqual(pending.results, [{ proposed_value: "revision 9" }]);
    const superseded = await env.DB.prepare("SELECT COUNT(*) AS count FROM proposals WHERE user_id=? AND status='superseded'")
      .bind(userId).first<{ count: number }>();
    assert.equal(superseded?.count, 9);
  } finally {
    await proxy.dispose();
  }
});
