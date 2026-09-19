import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { getSession, startGoogle, verifyForm } from "./auth.ts";
import { scenarios, scoreScenario } from "./evaluation.ts";
import { ingestFile } from "./files.ts";
import { applyProposal, cleanText, validateField, updateFieldFromPassport } from "./store.ts";
import { saveThread } from "./threads.ts";
import { getUsageState } from "./usage.ts";
import type { Env, Field, Session } from "./types.ts";

const style = `:root{font:16px system-ui;color:#1f2933;background:#f7f7f3}*{box-sizing:border-box}body{margin:0}main{max-width:760px;margin:0 auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h1{font-size:1.65rem}h2{font-size:1.18rem;margin-top:32px}a{color:#145f57}section,article{background:white;border:1px solid #dce1dc;border-radius:12px;padding:18px;margin:16px 0}label{display:block;font-weight:600;margin:12px 0 5px}input,textarea,select{width:100%;font:inherit;padding:10px;border:1px solid #9aa9a3;border-radius:8px}textarea{min-height:100px}button{font:inherit;background:#145f57;color:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer;margin-top:12px}.muted{color:#596963;font-size:.9rem}.field-help{display:none;margin:5px 0 0;color:#596963;font-size:.86rem}.field-group:focus-within .field-help{display:block}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row>*{margin:0}small{color:#596963}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}nav a{margin-left:14px}`;

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function page(title: string, body: string): Response {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#145f57"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Nomad"><link rel="apple-touch-icon" href="/icon.svg"><link rel="manifest" href="/manifest.webmanifest"><title>${esc(title)} · Nomad</title><style>${style}</style></head><body><main>${body}<footer class="muted"><a href="/privacy">Privacy</a> · <a href="/terms">Pilot terms</a></footer></main><script src="/register.js" defer></script></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'self'; manifest-src 'self'; connect-src 'self'",
    },
  });
}

function redirect(request: Request, path: string): Response {
  return Response.redirect(new URL(path, request.url), 303);
}

async function requireSession(request: Request, env: Env): Promise<Session | Response> {
  return await getSession(request, env) ?? redirect(request, "/login");
}

function isResponse(value: Session | Response): value is Response { return value instanceof Response; }

export async function revokeUserAccess(env: Env, userId: string): Promise<void> {
  let grantCursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(userId, { limit: 1000, cursor: grantCursor });
    await Promise.all(page.items.map((grant) => env.OAUTH_PROVIDER.revokeGrant(grant.id, userId)));
    grantCursor = page.cursor;
  } while (grantCursor);

  let sessionCursor: string | undefined;
  do {
    const page = await env.OAUTH_KV.list({ prefix: "nomad:session:", limit: 1000, cursor: sessionCursor });
    const sessions = await Promise.all(page.keys.map(async ({ name }) => ({
      name,
      value: await env.OAUTH_KV.get<Session>(name, "json"),
    })));
    await Promise.all(sessions.filter(({ value }) => value?.userId === userId).map(({ name }) => env.OAUTH_KV.delete(name)));
    sessionCursor = page.list_complete ? undefined : page.cursor;
  } while (sessionCursor);
}

function fieldForm(csrf: string, field?: Field) {
  const editing = !!field;
  return `<form method="post" action="${editing ? "/fields/edit" : "/fields/new"}">
    <input type="hidden" name="csrf" value="${esc(csrf)}">
    ${editing ? `<input type="hidden" name="id" value="${esc(field.id)}"><input type="hidden" name="version" value="${field.version}">` : ""}
    <p class="muted">Save one note for your assistants. You choose the words yourself; you do not need to find them on another website. Example: folder “personal,” note name “How I like answers,” and answer “Use short and simple words.”</p>
    <div class="field-group"><label for="project">Folder</label><input id="project" name="project" required maxlength="80" aria-describedby="project-help" value="${esc(field?.project ?? "personal")}"><small id="project-help" class="field-help">This is where the note belongs. If you are unsure, keep “personal.” For work, you could type “Nomad” or “job search.” You make this name yourself.</small></div>
    <div class="field-group"><label for="key">Note name</label><input id="key" name="key" required maxlength="80" aria-describedby="key-help" placeholder="For example: How I like answers" value="${esc(field?.key ?? "")}"><small id="key-help" class="field-help">Write what you want Nomad to remember. For example: “How I like answers,” “My time zone,” or “My current goal.” You make this name yourself.</small></div>
    <div class="field-group"><label for="value">Answer to remember</label><textarea id="value" name="value" required maxlength="4000" aria-describedby="value-help" placeholder="For example: Use short and simple words">${esc(field?.value ?? "")}</textarea><small id="value-help" class="field-help">Write the answer you want your assistants to know. Type it in your own words or copy it from your notes. Example: “Use short and simple words.”</small></div>
    <div class="field-group"><label for="sensitivity">Visibility</label><select id="sensitivity" name="sensitivity" aria-describedby="sensitivity-help">
      ${(["normal", "sensitive", "sealed"] as const).map((value) => `<option value="${value}" ${field?.sensitivity === value ? "selected" : ""}>${value === "sealed" ? "Sealed: never shared with assistants" : value === "sensitive" ? "Sensitive: changes require review" : "Normal"}</option>`).join("")}
    </select><small id="sensitivity-help" class="field-help">Choose how carefully Nomad handles this note. Normal can be shared. Sensitive asks you before changing it. Sealed never shares it with an assistant.</small></div><button type="submit">${editing ? "Save changes" : "Add field"}</button></form>`;
}

async function home(request: Request, env: Env, session: Session): Promise<Response> {
  const user = await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(session.userId).first<{ email: string }>();
  const fields = await env.DB.prepare(
    "SELECT * FROM fields WHERE user_id=? ORDER BY project,key LIMIT 200",
  ).bind(session.userId).all<Field>();
  const proposals = await env.DB.prepare(
    "SELECT p.id,p.proposed_value,p.reason,p.base_version,f.project,f.key,f.value,c.label " +
    "FROM proposals p JOIN fields f ON f.id=p.field_id JOIN clients c ON c.id=p.client_id " +
    "WHERE p.user_id=? AND p.status='pending' ORDER BY p.created_at DESC LIMIT 30",
  ).bind(session.userId).all<{ id: string; proposed_value: string; reason: string; base_version: number; project: string; key: string; value: string; label: string }>();
  const clients = await env.DB.prepare(
    "SELECT id,label,trust_mode FROM clients WHERE user_id=? ORDER BY label,id",
  ).bind(session.userId).all<{ id: string; label: string; trust_mode: "ask" | "auto" }>();
  return page("Passport", `<header><div><h1>Nomad passport</h1><div class="muted">${esc(user?.email)}</div></div><nav><a href="/files">Files</a><a href="/threads">Threads</a><a href="/metrics">Metrics</a><a href="/audit">Audit</a><a href="/account">Account</a></nav></header>
    <section><h2>Add something to remember</h2>${fieldForm(session.csrf)}</section>
    <h2>Your fields</h2>${fields.results.length ? fields.results.map((field) => `<article><div class="row"><strong>${esc(field.project)} / ${esc(field.key)}</strong><small>${esc(field.sensitivity)}</small></div><pre>${esc(field.value)}</pre><a href="/field/${encodeURIComponent(field.id)}">Edit</a></article>`).join("") : `<p class="muted">No fields yet. Add one above, then connect an assistant.</p>`}
    <h2>Review digest</h2><p class="muted">${proposals.results.length} pending change${proposals.results.length === 1 ? "" : "s"}. Review them here when convenient; Nomad never interrupts an assistant chat.</p>${proposals.results.length ? proposals.results.map((proposal) => `<article><strong>${esc(proposal.label)} proposes ${esc(proposal.project)} / ${esc(proposal.key)}</strong><p class="muted">Reason: ${esc(proposal.reason || "Not provided")}</p><p>Current</p><pre>${esc(proposal.value)}</pre><p>Proposed</p><pre>${esc(proposal.proposed_value)}</pre><div class="row"><form method="post" action="/proposals/approve"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="id" value="${esc(proposal.id)}"><button type="submit">Approve</button></form><form method="post" action="/proposals/reject"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="id" value="${esc(proposal.id)}"><button type="submit">Reject</button></form></div></article>`).join("") : `<p class="muted">None</p>`}
    <h2>Connected assistants</h2>${clients.results.length ? clients.results.map((client) => `<article><strong>${esc(client.label)}</strong><form method="post" action="/clients/trust"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="id" value="${esc(client.id)}"><label for="trust-${esc(client.id)}">Save behavior</label><select id="trust-${esc(client.id)}" name="trust_mode"><option value="ask" ${client.trust_mode === "ask" ? "selected" : ""}>Ask before overwriting</option><option value="auto" ${client.trust_mode === "auto" ? "selected" : ""}>Automatically apply explicit updates</option></select><button type="submit">Save trust setting</button></form></article>`).join("") : `<p class="muted">No assistants connected.</p>`}
    <form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button type="submit">Sign out</button></form>`);
}

async function consent(request: Request, env: Env, session: Session): Promise<Response> {
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket || !/^[0-9a-f-]{36}$/.test(ticket)) return new Response("Invalid consent request.", { status: 400 });
  const pending = await env.OAUTH_KV.get<{ userId: string; request: AuthRequest }>(`nomad:consent:${ticket}`, "json");
  if (!pending || pending.userId !== session.userId) return new Response("Consent request expired.", { status: 400 });
  const client = await env.OAUTH_PROVIDER.lookupClient(pending.request.clientId);
  if (!client) return new Response("Unknown assistant client.", { status: 400 });
  return page("Connect assistant", `<header><h1>Connect an assistant</h1></header><section><p>This client requests ${pending.request.scope.includes("mcp:read") ? "read access to your unsealed fields" : "no read access"}${pending.request.scope.includes("mcp:write") ? " and permission to save new facts or propose changes" : ""}: <strong>${esc(client.clientName || "Unnamed client")}</strong>.</p>
    <p>You choose the label shown in the audit log. Enter “ChatGPT,” “Claude,” or “Gemini” only after checking which assistant opened this page.</p>
    <form method="post" action="/consent"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="ticket" value="${esc(ticket)}"><label for="label">Audit label</label><input id="label" name="label" required maxlength="80" autocomplete="off"><button type="submit">Connect</button></form></section>`);
}

async function completeConsent(request: Request, env: Env, session: Session, form: FormData): Promise<Response> {
  const ticket = String(form.get("ticket") ?? "");
  const label = String(form.get("label") ?? "").trim().slice(0, 80);
  if (!/^[0-9a-f-]{36}$/.test(ticket) || !label) return new Response("Invalid consent form.", { status: 400 });
  const pending = await env.OAUTH_KV.get<{ userId: string; request: AuthRequest }>(`nomad:consent:${ticket}`, "json");
  if (!pending || pending.userId !== session.userId) return new Response("Consent request expired.", { status: 400 });
  await env.OAUTH_KV.delete(`nomad:consent:${ticket}`);
  const oauthClient = await env.OAUTH_PROVIDER.lookupClient(pending.request.clientId);
  if (!oauthClient) return new Response("Unknown assistant client.", { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO clients(id,user_id,label,oauth_client_id) VALUES(?,?,?,?) ON CONFLICT(user_id,oauth_client_id) DO UPDATE SET label=excluded.label",
  ).bind(id, session.userId, label, pending.request.clientId).run();
  const client = await env.DB.prepare("SELECT id FROM clients WHERE user_id=? AND oauth_client_id=?")
    .bind(session.userId, pending.request.clientId).first<{ id: string }>();
  if (!client) throw new Error("Client creation failed.");
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: pending.request,
    userId: session.userId,
    metadata: { clientName: label },
    scope: pending.request.scope,
    props: { userId: session.userId, clientId: client.id },
  });
  return Response.redirect(redirectTo, 302);
}

export async function handleApp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return Response.json({
      status: "ok",
      phase: "M8",
      environment: env.ENVIRONMENT ?? "development",
      release: env.RELEASE ?? "local",
      googleConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    });
  }
  if (url.pathname === "/manifest.webmanifest") return Response.json({ name: "Nomad passport", short_name: "Nomad", start_url: "/", display: "standalone", background_color: "#f7f7f3", theme_color: "#145f57", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] }, { headers: { "Content-Type": "application/manifest+json" } });
  if (url.pathname === "/icon.svg") return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="#145f57"/><path d="M45 139V53h21l61 53V53h20v86h-20L65 86v53z" fill="#fff"/></svg>', { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
  if (url.pathname === "/register.js") return new Response("if('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js');", { headers: { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=3600" } });
  if (url.pathname === "/service-worker.js") return new Response("self.addEventListener('fetch',()=>{});", { headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" } });
  if (url.pathname === "/welcome" && request.method === "GET") return page("Welcome", `<header><h1>Your context, between assistants</h1><a href="/login">Sign in</a></header><section><p>Nomad is a passport for facts, files, and conversation handoffs you choose to share with ChatGPT, Claude, and Gemini.</p><p><a href="/setup">Set up a connector</a> · <a href="/limits">Read the limits</a> · <a href="/install">Install Nomad</a></p></section>`);
  if (url.pathname === "/privacy" && request.method === "GET") return page("Privacy", `<header><h1>Privacy</h1><a href="/welcome">About Nomad</a></header><section><p><strong>Last updated: September 19, 2026.</strong></p><p>Nomad stores the context, files, and conversation handoffs you choose to save. It also stores your Google account identifier and email address for sign-in, connected assistant identifiers, access records, and service usage counters.</p><p>Nomad uses Google for sign-in and Cloudflare to run the service and store data. Connected assistants receive only the unsealed data authorized through the connector. Sealed fields are excluded from assistant tools.</p><p>Your information remains until you use the account page to export and permanently delete your account. Account deletion revokes Nomad access and deletes its database rows, sessions, and uploaded objects.</p><p>Do not upload regulated, classified, or employer-confidential information during the pilot. Contact ${env.SUPPORT_EMAIL ? `<a href="mailto:${esc(env.SUPPORT_EMAIL)}">${esc(env.SUPPORT_EMAIL)}</a>` : "the Nomad pilot owner"} for privacy questions.</p></section>`);
  if (url.pathname === "/terms" && request.method === "GET") return page("Pilot terms", `<header><h1>Pilot terms</h1><a href="/welcome">About Nomad</a></header><section><p><strong>Last updated: September 19, 2026.</strong></p><p>Nomad is an evaluation service. You are responsible for the material you save and for checking assistant output before relying on it. Do not use the pilot for regulated, classified, safety-critical, or employer-confidential information.</p><p>Assistant providers decide when to call a connector and may retain information already sent to them under their own terms. Nomad cannot retract that information. Availability and data recovery are not guaranteed during the pilot.</p><p>You may stop using Nomad at any time and permanently delete your account from the account page. Production or enterprise use requires a separate security review, operating agreement, and approved organization configuration.</p></section>`);
  if (url.pathname === "/setup" && request.method === "GET") return page("Setup", `<header><h1>Connect an assistant</h1><a href="/welcome">About Nomad</a></header><section><p>Use this MCP URL: <code>${esc(env.PUBLIC_ORIGIN)}/mcp</code></p><h2>ChatGPT</h2><ol><li>Open developer mode on ChatGPT web.</li><li>Add the MCP URL as a connector.</li><li>Sign in and label the client ChatGPT.</li></ol><h2>Claude</h2><ol><li>Add a custom connector with the MCP URL.</li><li>Sign in and label the client Claude.</li></ol><h2>Gemini</h2><ol><li>On Gemini web, open Settings, then Personal Intelligence, then Connected Apps.</li><li>Under Custom apps, add the MCP URL.</li><li>Review Gemini's connection warning, sign in, and label the client Gemini.</li></ol><p>Ask directly: “Use Nomad Passport to load my saved context.”</p></section>`);
  if (url.pathname === "/limits" && request.method === "GET") return page("Limits", `<header><h1>Honest limits</h1><a href="/welcome">About Nomad</a></header><section><ul><li>The model decides when to call Nomad. Nomad cannot force it.</li><li>Nomad cannot silently watch or mirror a conversation.</li><li>Nomad does not synchronize an assistant's own memory.</li><li>Context already sent to a provider cannot be retracted.</li><li>Assistant providers may restrict custom connectors by account, plan, region, age, language, or workspace policy.</li></ul></section>`);
  if (url.pathname === "/install" && request.method === "GET") return page("Install", `<header><h1>Install Nomad</h1><a href="/welcome">About Nomad</a></header><section><p>Open your browser's install or Add to Home Screen menu. Nomad's manifest supports standalone installation on desktop, Android, and iPhone.</p></section>`);
  if (url.pathname === "/login" && request.method === "GET") return startGoogle(request, env);
  if (url.pathname === "/auth/google/callback" && request.method === "GET") {
    const { finishGoogle } = await import("./auth.ts");
    return finishGoogle(request, env);
  }
  if (url.pathname === "/authorize" && request.method === "GET") {
    const oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const session = await getSession(request, env);
    if (!session) return startGoogle(request, env, oauthRequest);
    const ticket = crypto.randomUUID();
    await env.OAUTH_KV.put(`nomad:consent:${ticket}`, JSON.stringify({ userId: session.userId, request: oauthRequest }), { expirationTtl: 600 });
    return redirect(request, `/consent?ticket=${ticket}`);
  }
  const session = await requireSession(request, env);
  if (isResponse(session)) return session;
  if (request.method === "POST" && !["/logout", "/account/delete"].includes(url.pathname)) {
    const [globalLimit, userLimit] = await Promise.all([
      env.GLOBAL_RATE_LIMIT.limit({ key: "nomad-core" }),
      env.USER_RATE_LIMIT.limit({ key: session.userId }),
    ]);
    if (!globalLimit.success || !userLimit.success) return new Response("Nomad is busy. Please retry in a minute.", { status: 429 });
  }
  if (url.pathname === "/consent" && request.method === "GET") return consent(request, env, session);
  if (url.pathname === "/" && request.method === "GET") return home(request, env, session);
  if (url.pathname === "/onboarding" && request.method === "GET") return page("Onboarding", `<header><h1>Start your passport</h1><a href="/">Passport</a></header><section><form method="post" action="/onboarding/seed"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><label for="writing_style">How should assistants write for you?</label><input id="writing_style" name="writing_style"><label for="timezone">What timezone do you use?</label><input id="timezone" name="timezone"><label for="current_project">What are you working on?</label><input id="current_project" name="current_project"><button type="submit">Save answers</button></form></section><section><h2>Import a memory export</h2><form method="post" action="/onboarding/import"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><label for="memory">JSON object of field names and values</label><textarea id="memory" name="memory" required></textarea><button type="submit">Import</button></form></section>`);
  if (url.pathname === "/files" && request.method === "GET") {
    const files = await env.DB.prepare("SELECT id,name,mime_type,status,outline,extraction_count,created_at FROM files WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100")
      .bind(session.userId).all<{ id: string; name: string; mime_type: string; status: string; outline: string; extraction_count: number; created_at: string }>();
    return page("Files", `<header><h1>Files</h1><a href="/">Passport</a></header><section><form method="post" action="/files/upload" enctype="multipart/form-data"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><label for="file">PDF, Markdown, or text up to 10 MB</label><input id="file" name="file" type="file" accept="application/pdf,text/plain,text/markdown" required><button type="submit">Upload and extract once</button></form></section>${files.results.map((file) => `<article><strong>${esc(file.name)}</strong><p class="muted">${esc(file.status)} · extracted ${file.extraction_count} time${file.extraction_count === 1 ? "" : "s"}</p><pre>${esc(file.outline)}</pre></article>`).join("")}`);
  }
  if (url.pathname === "/threads" && request.method === "GET") {
    const threads = await env.DB.prepare("SELECT id,title,source,capture_kind,created_at FROM threads WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100")
      .bind(session.userId).all<{ id: string; title: string; source: string; capture_kind: string; created_at: string }>();
    return page("Threads", `<header><h1>Thread handoffs</h1><a href="/">Passport</a></header><section><h2>Paste a high-fidelity handoff</h2><form method="post" action="/threads/new"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><label for="title">Title</label><input id="title" name="title" required maxlength="180"><label for="source">Source</label><input id="source" name="source" value="Pasted transcript" required maxlength="80"><input type="hidden" name="capture_kind" value="verbatim"><label for="content">Conversation</label><textarea id="content" name="content" required maxlength="100000"></textarea><button type="submit">Save verbatim handoff</button></form></section>${threads.results.map((thread) => `<article><a href="/thread/${encodeURIComponent(thread.id)}"><strong>${esc(thread.title)}</strong></a><p class="muted">${esc(thread.source)} · ${esc(thread.capture_kind)}</p></article>`).join("")}`);
  }
  const threadId = url.pathname.match(/^\/thread\/([0-9a-f-]{36})$/)?.[1];
  if (threadId && request.method === "GET") {
    const thread = await env.DB.prepare("SELECT title,source,content,capture_kind,created_at FROM threads WHERE id=? AND user_id=?")
      .bind(threadId, session.userId).first<{ title: string; source: string; content: string; capture_kind: string; created_at: string }>();
    if (!thread) return new Response("Thread not found.", { status: 404 });
    return page("Thread", `<header><h1>${esc(thread.title)}</h1><a href="/threads">Threads</a></header><section><p class="muted">${esc(thread.source)} · ${esc(thread.capture_kind)}</p>${thread.capture_kind === "model_summarized" ? `<p><strong>This is a model-generated summary and may omit original details.</strong></p>` : ""}<pre>${esc(thread.content)}</pre></section>`);
  }
  if (url.pathname === "/account/export" && request.method === "GET") {
    const [fields, versions, clients, proposals, audit, files, chunks, threads, evaluations] = await Promise.all([
      env.DB.prepare("SELECT * FROM fields WHERE user_id=? ORDER BY project,key").bind(session.userId).all(),
      env.DB.prepare("SELECT v.* FROM field_versions v JOIN fields f ON f.id=v.field_id WHERE f.user_id=? ORDER BY v.created_at,v.rowid").bind(session.userId).all(),
      env.DB.prepare("SELECT id,label,trust_mode,connected_at FROM clients WHERE user_id=? ORDER BY connected_at,id").bind(session.userId).all(),
      env.DB.prepare("SELECT * FROM proposals WHERE user_id=? ORDER BY created_at,id").bind(session.userId).all(),
      env.DB.prepare("SELECT action,target_ids,value_hash,created_at FROM audit WHERE user_id=? ORDER BY created_at,id").bind(session.userId).all(),
      env.DB.prepare("SELECT id,name,mime_type,sha256,status,outline,extraction_count,created_at FROM files WHERE user_id=? ORDER BY created_at,id").bind(session.userId).all(),
      env.DB.prepare("SELECT id,file_id,chunk_index,heading,text,token_count,created_at FROM file_chunks WHERE user_id=? ORDER BY file_id,chunk_index").bind(session.userId).all(),
      env.DB.prepare("SELECT id,source,title,content,capture_kind,created_at FROM threads WHERE user_id=? ORDER BY created_at,id").bind(session.userId).all(),
      env.DB.prepare("SELECT client_label,scenario_id,expected_tool,observed_tool,expected_scope,passed,created_at FROM evaluation_runs WHERE user_id=? ORDER BY created_at,id").bind(session.userId).all(),
    ]);
    return Response.json({ exported_at: new Date().toISOString(), fields: fields.results, field_versions: versions.results, clients: clients.results, proposals: proposals.results, audit: audit.results, files: files.results, file_chunks: chunks.results, threads: threads.results, evaluations: evaluations.results }, { headers: { "Content-Disposition": "attachment; filename=nomad-export.json" } });
  }
  if (url.pathname === "/account" && request.method === "GET") return page("Account", `<header><h1>Account</h1><a href="/">Passport</a></header><section><h2>Export</h2><p>Download fields, field history, clients, proposals, audit metadata, extracted file text, threads, and evaluation results.</p><a href="/account/export">Download JSON export</a></section><section><h2>Hard delete</h2><p>This permanently deletes the account, D1 rows, sessions, and uploaded R2 objects.</p><form method="post" action="/account/delete"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><label for="confirm">Type DELETE</label><input id="confirm" name="confirm" required pattern="DELETE"><button type="submit">Delete account permanently</button></form></section>`);
  if (url.pathname === "/metrics" && request.method === "GET") {
    const [calls, evaluations, proposalTimes, sealedLeaks, usage] = await Promise.all([
      env.DB.prepare("SELECT c.label,a.action,COUNT(*) AS count FROM audit a LEFT JOIN clients c ON c.id=a.client_id WHERE a.user_id=? GROUP BY c.label,a.action ORDER BY c.label,a.action").bind(session.userId).all<{ label: string | null; action: string; count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS total,SUM(passed) AS passed FROM evaluation_runs WHERE user_id=?").bind(session.userId).first<{ total: number; passed: number | null }>(),
      env.DB.prepare("SELECT (julianday(decided_at)-julianday(created_at))*86400.0 AS seconds FROM proposals WHERE user_id=? AND decided_at IS NOT NULL ORDER BY seconds").bind(session.userId).all<{ seconds: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM audit a WHERE a.user_id=? AND EXISTS (SELECT 1 FROM fields f WHERE f.user_id=a.user_id AND f.sensitivity='sealed' AND instr(a.target_ids,f.id)>0)").bind(session.userId).first<{ count: number }>(),
      getUsageState(env, session.userId),
    ]);
    const rate = evaluations?.total ? Math.round(((evaluations.passed ?? 0) / evaluations.total) * 100) : null;
    const sorted = proposalTimes.results.map((row) => row.seconds).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = !sorted.length ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return page("Metrics", `<header><h1>Evidence</h1><nav><a href="/evaluation">Run evaluation</a><a href="/">Passport</a></nav></header><section><h2>Tool-call rate</h2><p>${rate === null ? "No scored evaluation runs yet." : `${rate}% across ${evaluations?.total} scenarios.`}</p><h2>Median decision time</h2><p>${median === null ? "Not available until a proposal is decided." : `${median.toFixed(1)} seconds across ${sorted.length} decisions.`}</p><p class="muted">Review friction should be investigated when the median falls below two seconds.</p><h2>Sealed-field leaks</h2><p>${sealedLeaks?.count ?? 0}</p><h2>Free-tier warnings</h2>${usage.warnings.length ? usage.warnings.map((warning) => `<p>${esc(warning.kind)}: ${warning.amount} / ${warning.limit}</p>`).join("") : "<p>All tracked counters are below the 80% warning thresholds.</p>"}<h2>Observed tool calls</h2>${calls.results.map((row) => `<p>${esc(row.label ?? "Passport")} · ${esc(row.action)}: ${row.count}</p>`).join("") || "<p>None yet.</p>"}</section>`);
  }
  if (url.pathname === "/evaluation" && request.method === "GET") return page("Evaluation", `<header><h1>Evaluation scenarios</h1><a href="/metrics">Metrics</a></header><p>Run each prompt in ChatGPT, Claude, or Gemini, then record the observed tool and whether its scope was correct.</p>${scenarios.map((scenario) => `<article><strong>${esc(scenario.id)}</strong><pre>${esc(scenario.prompt)}</pre><p class="muted">Expected: ${esc(scenario.expected_tool)} · ${esc(scenario.expected_scope)}</p><form method="post" action="/evaluation/result"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><input type="hidden" name="scenario_id" value="${esc(scenario.id)}"><label>Client</label><select name="client_label"><option>ChatGPT</option><option>Claude</option><option>Gemini</option></select><label>Observed tool</label><input name="observed_tool" maxlength="80"><label><input name="scope_correct" type="checkbox" value="yes"> Scope was correct</label><button type="submit">Record result</button></form></article>`).join("")}`);
  if (url.pathname === "/audit" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT a.action,a.target_ids,a.created_at,c.label FROM audit a LEFT JOIN clients c ON c.id=a.client_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 50")
      .bind(session.userId).all<{ action: string; target_ids: string; created_at: string; label: string | null }>();
    return page("Audit", `<header><h1>Recent reads</h1><a href="/">Passport</a></header><section>${rows.results.length ? rows.results.map((row) => `<p><strong>${esc(row.label ?? "Passport")}</strong> · ${esc(row.action)} · ${esc(row.created_at)}<br><small>${esc(row.target_ids)}</small></p>`).join("") : "No reads yet."}</section>`);
  }
  const fieldId = url.pathname.match(/^\/field\/([0-9a-f-]{36})$/)?.[1];
  if (fieldId && request.method === "GET") {
    const field = await env.DB.prepare("SELECT * FROM fields WHERE id=? AND user_id=?").bind(fieldId, session.userId).first<Field>();
    if (!field) {
      const chunk = await env.DB.prepare("SELECT c.heading,c.text,c.chunk_index,f.name FROM file_chunks c JOIN files f ON f.id=c.file_id WHERE c.id=? AND c.user_id=?")
        .bind(fieldId, session.userId).first<{ heading: string; text: string; chunk_index: number; name: string }>();
      if (!chunk) return new Response("Document not found.", { status: 404 });
      return page("File excerpt", `<header><h1>${esc(chunk.name)}</h1><a href="/files">Files</a></header><section><p class="muted">${esc(chunk.heading)} · chunk ${chunk.chunk_index + 1}</p><pre>${esc(chunk.text)}</pre></section>`);
    }
    const history = await env.DB.prepare(
      "SELECT value,actor_kind,created_at FROM field_versions WHERE field_id=? ORDER BY created_at DESC,rowid DESC LIMIT 50",
    ).bind(field.id).all<{ value: string; actor_kind: string; created_at: string }>();
    return page("Edit field", `<header><h1>Edit field</h1><a href="/">Passport</a></header><section>${fieldForm(session.csrf, field)}</section><h2>Version history</h2>${history.results.map((version) => `<article><small>${esc(version.created_at)} · ${esc(version.actor_kind)}</small><pre>${esc(version.value)}</pre></article>`).join("")}`);
  }
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  const form = await request.formData();
  if (!verifyForm(request, session, form, url.pathname === "/consent")) return new Response("Invalid form origin or CSRF token.", { status: 403 });
  if (!["/logout", "/account/delete"].includes(url.pathname) && (env.READ_ONLY_MODE === "true" || (await getUsageState(env, session.userId)).read_only)) {
    return new Response("Nomad is temporarily read-only. Existing context and account export remain available.", { status: 503 });
  }
  if (url.pathname === "/consent") return completeConsent(request, env, session, form);
  if (url.pathname === "/fields/new") {
    const { project, key, value } = validateField(String(form.get("project") ?? ""), String(form.get("key") ?? ""), String(form.get("value") ?? ""));
    const sensitivity = String(form.get("sensitivity") ?? "normal");
    if (!["normal", "sensitive", "sealed"].includes(sensitivity)) return new Response("Invalid visibility.", { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO fields(id,user_id,project,key,value,sensitivity) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,project,key) DO NOTHING")
        .bind(id, session.userId, project, key, value, sensitivity),
      env.DB.prepare("INSERT INTO field_versions(id,field_id,value,actor,actor_kind) SELECT ?,id,value,?,'user' FROM fields WHERE id=?")
        .bind(crypto.randomUUID(), session.userId, id),
    ]);
    const inserted = await env.DB.prepare("SELECT id FROM fields WHERE id=? AND user_id=?").bind(id, session.userId).first();
    return inserted ? redirect(request, "/") : new Response("A field with that name already exists.", { status: 409 });
  }
  if (url.pathname === "/onboarding/seed") {
    const entries = [["writing_style", form.get("writing_style")], ["timezone", form.get("timezone")], ["current_project", form.get("current_project")]]
      .map(([key, value]) => [String(key), String(value ?? "").trim()] as const).filter(([, value]) => value);
    await env.DB.batch(entries.flatMap(([key, value]) => {
      const id = crypto.randomUUID();
      return [
        env.DB.prepare("INSERT INTO fields(id,user_id,project,key,value,sensitivity) VALUES(?,?,'personal',?,?,'normal') ON CONFLICT(user_id,project,key) DO NOTHING").bind(id, session.userId, key, cleanText(value, 4000)),
        env.DB.prepare("INSERT INTO field_versions(id,field_id,value,actor,actor_kind) SELECT ?,id,value,?,'user' FROM fields WHERE id=?").bind(crypto.randomUUID(), session.userId, id),
      ];
    }));
    return redirect(request, "/");
  }
  if (url.pathname === "/onboarding/import") {
    let values: unknown;
    try { values = JSON.parse(String(form.get("memory") ?? "")); } catch { return new Response("Import must be valid JSON.", { status: 400 }); }
    if (!values || Array.isArray(values) || typeof values !== "object") return new Response("Import must be a JSON object.", { status: 400 });
    const entries = Object.entries(values).slice(0, 100).map(([key, value]) => validateField("imported", key, String(value)));
    await env.DB.batch(entries.flatMap((entry) => {
      const id = crypto.randomUUID();
      return [
        env.DB.prepare("INSERT INTO fields(id,user_id,project,key,value,sensitivity) VALUES(?,?,?,?,?,'normal') ON CONFLICT(user_id,project,key) DO NOTHING")
          .bind(id, session.userId, entry.project, entry.key, entry.value),
        env.DB.prepare("INSERT INTO field_versions(id,field_id,value,actor,actor_kind) SELECT ?,id,value,?,'user' FROM fields WHERE id=?")
          .bind(crypto.randomUUID(), session.userId, id),
      ];
    }));
    return redirect(request, "/");
  }
  if (url.pathname === "/files/upload") {
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) return new Response("Choose a file.", { status: 400 });
    await ingestFile(env, session.userId, uploaded.name, uploaded.type, new Uint8Array(await uploaded.arrayBuffer()));
    return redirect(request, "/files");
  }
  if (url.pathname === "/threads/new") {
    await saveThread(env, { userId: session.userId, clientId: "" }, {
      title: String(form.get("title") ?? ""), content: String(form.get("content") ?? ""),
      source: String(form.get("source") ?? "Pasted transcript"), capture_kind: String(form.get("capture_kind") ?? "verbatim") as "verbatim" | "model_summarized",
    });
    return redirect(request, "/threads");
  }
  if (url.pathname === "/fields/edit") {
    const sensitivity = String(form.get("sensitivity") ?? "");
    const version = Number(form.get("version"));
    if (!["normal", "sensitive", "sealed"].includes(sensitivity) || !Number.isSafeInteger(version) || version < 1) return new Response("Invalid field update.", { status: 400 });
    const applied = await updateFieldFromPassport(env, session.userId, {
      id: String(form.get("id") ?? ""), version,
      project: String(form.get("project") ?? ""), key: String(form.get("key") ?? ""), value: String(form.get("value") ?? ""),
      sensitivity: sensitivity as Field["sensitivity"],
    });
    return applied ? redirect(request, "/") : new Response("This field changed. Reload and review the latest value.", { status: 409 });
  }
  if (url.pathname === "/proposals/approve") {
    const result = await applyProposal(env, session.userId, String(form.get("id") ?? ""));
    if (result === "missing") return new Response("Proposal not found.", { status: 404 });
    if (result === "superseded") return new Response("The field changed before approval. This proposal was superseded and the current value was preserved.", { status: 409 });
    return redirect(request, "/");
  }
  if (url.pathname === "/proposals/reject") {
    const result = await env.DB.prepare("UPDATE proposals SET status='rejected',decided_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='pending'")
      .bind(String(form.get("id") ?? ""), session.userId).run();
    return result.meta.changes ? redirect(request, "/") : new Response("Proposal not found.", { status: 404 });
  }
  if (url.pathname === "/clients/trust") {
    const trustMode = String(form.get("trust_mode") ?? "");
    if (!(["ask", "auto"] as const).includes(trustMode as "ask" | "auto")) return new Response("Invalid trust mode.", { status: 400 });
    const result = await env.DB.prepare("UPDATE clients SET trust_mode=? WHERE id=? AND user_id=?")
      .bind(trustMode, String(form.get("id") ?? ""), session.userId).run();
    return result.meta.changes ? redirect(request, "/") : new Response("Assistant not found.", { status: 404 });
  }
  if (url.pathname === "/account/delete") {
    if (form.get("confirm") !== "DELETE") return new Response("Type DELETE to confirm.", { status: 400 });
    await revokeUserAccess(env, session.userId);
    const objects = await env.DB.prepare("SELECT r2_key FROM files WHERE user_id=?").bind(session.userId).all<{ r2_key: string }>();
    await Promise.all(objects.results.map((object) => env.FILES.delete(object.r2_key)));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM evaluation_runs WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM usage_events WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM audit WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM proposals WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM field_versions WHERE field_id IN (SELECT id FROM fields WHERE user_id=?)").bind(session.userId),
      env.DB.prepare("DELETE FROM fields WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM file_chunks_fts WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM file_chunks WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM files WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM threads WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM clients WHERE user_id=?").bind(session.userId),
      env.DB.prepare("DELETE FROM users WHERE id=?").bind(session.userId),
    ]);
    const requestUrl = new URL(request.url);
    const cookieName = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1" ? "nomad_session" : "__Host-nomad_session";
    return new Response(null, { status: 303, headers: {
      Location: new URL("/welcome", request.url).toString(),
      "Set-Cookie": `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${requestUrl.protocol === "https:" ? "; Secure" : ""}`,
    } });
  }
  if (url.pathname === "/evaluation/result") {
    const scenario = scenarios.find((item) => item.id === form.get("scenario_id"));
    const clientLabel = cleanText(String(form.get("client_label") ?? ""), 80);
    const observedTool = cleanText(String(form.get("observed_tool") ?? ""), 80) || null;
    if (!scenario || !clientLabel) return new Response("Invalid evaluation result.", { status: 400 });
    const scopeCorrect = form.get("scope_correct") === "yes";
    await env.DB.prepare("INSERT INTO evaluation_runs(id,user_id,client_label,scenario_id,expected_tool,observed_tool,expected_scope,passed) VALUES(?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), session.userId, clientLabel, scenario.id, scenario.expected_tool, observedTool, scenario.expected_scope, scoreScenario(scenario.expected_tool, observedTool, scopeCorrect) ? 1 : 0).run();
    return redirect(request, "/evaluation");
  }
  if (url.pathname === "/logout") {
    const name = new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1" ? "nomad_session" : "__Host-nomad_session";
    const token = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
    if (token) await env.OAUTH_KV.delete(`nomad:session:${token}`);
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL("/", request.url).toString(),
        "Set-Cookie": `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  }
  return new Response("Not found", { status: 404 });
}
