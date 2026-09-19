import { auditRead, cleanText } from "./store.ts";
import type { Env, Identity } from "./types.ts";
import { recordUsage } from "./usage.ts";

export type CaptureKind = "verbatim" | "model_summarized";

export async function saveThread(
  env: Env,
  identity: Identity,
  input: { title: string; content: string; capture_kind: CaptureKind; source: string },
) {
  const title = cleanText(input.title, 180);
  const content = cleanText(input.content, 100_000);
  const source = cleanText(input.source, 80);
  if (!title || !content || !source || !["verbatim", "model_summarized"].includes(input.capture_kind)) {
    throw new Error("Title, content, source, and capture kind are required.");
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO threads(id,user_id,source_client_id,source,title,content,capture_kind) VALUES(?,?,?,?,?,?,?)",
  ).bind(id, identity.userId, identity.clientId || null, source, title, content, input.capture_kind).run();
  await recordUsage(env, identity.userId, "d1_writes");
  return { id, status: "saved" as const, capture_kind: input.capture_kind };
}

export async function getThread(env: Env, identity: Identity, id: string) {
  const thread = await env.DB.prepare(
    "SELECT id,source,title,content,capture_kind,created_at FROM threads WHERE id=? AND user_id=?",
  ).bind(id, identity.userId).first<{ id: string; source: string; title: string; content: string; capture_kind: CaptureKind; created_at: string }>();
  await auditRead(env, identity, "get_thread", thread ? [thread.id] : [], thread ? [thread.content] : []);
  if (!thread) return null;
  return {
    ...thread,
    notice: thread.capture_kind === "model_summarized"
      ? "This is a model-generated summary and may omit details from the original conversation."
      : "This is a verbatim user-provided capture.",
  };
}

export async function listThreads(env: Env, identity: Identity) {
  const rows = await env.DB.prepare(
    "SELECT id,source,title,capture_kind,created_at FROM threads WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
  ).bind(identity.userId).all<{ id: string; source: string; title: string; capture_kind: CaptureKind; created_at: string }>();
  await auditRead(env, identity, "list_threads", rows.results.map((row) => row.id), rows.results.map((row) => row.title));
  return rows.results;
}
