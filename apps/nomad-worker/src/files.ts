import { extractText as extractPdfText } from "unpdf";
import { auditRead, cleanText, ftsQuery } from "./store.ts";
import type { Env, Identity } from "./types.ts";
import { recordUsage } from "./usage.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CHUNK_TOKENS = 800;
const TARGET_CHARS = 2600;
const MAX_CHARS = MAX_CHUNK_TOKENS * 4;

export interface FileChunk {
  id: string;
  file_id: string;
  chunk_index: number;
  heading: string;
  text: string;
  token_count: number;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function tokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitLong(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if (current && current.length + word.length + 1 > MAX_CHARS) {
      parts.push(current);
      current = "";
    }
    current += `${current ? " " : ""}${word}`;
  }
  if (current) parts.push(current);
  return parts;
}

export function chunkMarkdown(markdown: string): Array<{ heading: string; text: string; token_count: number }> {
  const blocks = markdown.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const chunks: Array<{ heading: string; text: string; token_count: number }> = [];
  let heading = "Document";
  let current = "";
  const flush = () => {
    if (!current) return;
    chunks.push({ heading, text: current, token_count: tokenCount(current) });
    current = "";
  };
  for (const block of blocks) {
    const headingMatch = block.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      heading = cleanText(headingMatch[1], 200) || "Document";
      continue;
    }
    for (const part of splitLong(block)) {
      if (current && current.length + part.length + 2 > TARGET_CHARS) flush();
      current += `${current ? "\n\n" : ""}${part}`;
    }
  }
  flush();
  return chunks.length ? chunks : [{ heading: "Document", text: "", token_count: 1 }];
}

async function extract(bytes: Uint8Array, mimeType: string, name: string): Promise<string> {
  if (mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const result = await extractPdfText(bytes, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  }
  if (mimeType.startsWith("text/") || /\.(md|txt|csv|json)$/i.test(name)) return new TextDecoder().decode(bytes);
  throw new Error("Only PDF, Markdown, and text files are supported.");
}

export async function ingestFile(env: Env, userId: string, rawName: string, rawMimeType: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error("File must be between 1 byte and 10 MB.");
  const name = cleanText(rawName, 180);
  const mimeType = cleanText(rawMimeType || "application/octet-stream", 120);
  if (!name) throw new Error("File name is required.");
  const hash = await sha256(bytes);
  const existing = await env.DB.prepare("SELECT id FROM files WHERE user_id=? AND sha256=?")
    .bind(userId, hash).first<{ id: string }>();
  if (existing) return { id: existing.id, extracted: false };
  const id = crypto.randomUUID();
  const key = `${userId}/${id}/${encodeURIComponent(name)}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mimeType }, customMetadata: { userId, name } });
  await recordUsage(env, userId, "r2_class_a");
  await recordUsage(env, userId, "r2_storage_bytes", bytes.length);
  await env.DB.prepare("INSERT INTO files(id,user_id,name,mime_type,r2_key,sha256) VALUES(?,?,?,?,?,?)")
    .bind(id, userId, name, mimeType, key, hash).run();
  try {
    const markdown = cleanText(await extract(bytes, mimeType, name), 2_000_000);
    if (!markdown) throw new Error("No extractable text was found.");
    const chunks = chunkMarkdown(markdown);
    const statements: D1PreparedStatement[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const chunkId = crypto.randomUUID();
      statements.push(
        env.DB.prepare("INSERT INTO file_chunks(id,file_id,user_id,chunk_index,heading,text,token_count) VALUES(?,?,?,?,?,?,?)")
          .bind(chunkId, id, userId, index, chunk.heading, chunk.text, chunk.token_count),
        env.DB.prepare("INSERT INTO file_chunks_fts(chunk_id,file_id,user_id,name,heading,text) VALUES(?,?,?,?,?,?)")
          .bind(chunkId, id, userId, name, chunk.heading, chunk.text),
      );
    }
    statements.push(env.DB.prepare("UPDATE files SET status='ready',outline=?,extraction_count=extraction_count+1 WHERE id=? AND extraction_count=0")
      .bind(chunks.map((chunk) => chunk.heading).filter((value, index, all) => all.indexOf(value) === index).join("\n"), id));
    await env.DB.batch(statements);
    await recordUsage(env, userId, "d1_writes", statements.length + 1);
    return { id, extracted: true, chunks: chunks.length };
  } catch (error) {
    await env.DB.prepare("UPDATE files SET status='failed' WHERE id=?").bind(id).run();
    throw error;
  }
}

export async function listFiles(env: Env, identity: Identity) {
  const rows = await env.DB.prepare(
    "SELECT f.id,f.name,f.mime_type,f.status,f.outline,f.created_at,COUNT(c.id) AS chunk_count FROM files f LEFT JOIN file_chunks c ON c.file_id=f.id WHERE f.user_id=? GROUP BY f.id ORDER BY f.created_at DESC,f.id DESC LIMIT 100",
  ).bind(identity.userId).all<{ id: string; name: string; mime_type: string; status: string; outline: string; created_at: string; chunk_count: number }>();
  await auditRead(env, identity, "list_files", rows.results.map((row) => row.id), rows.results.map((row) => row.name));
  return rows.results;
}

export async function listFileChunks(env: Env, identity: Identity, fileId: string) {
  const rows = await env.DB.prepare(
    "SELECT id,file_id,chunk_index,heading,text,token_count FROM file_chunks WHERE file_id=? AND user_id=? ORDER BY chunk_index",
  ).bind(fileId, identity.userId).all<FileChunk>();
  return rows.results;
}

export async function getFileChunk(env: Env, identity: Identity, id: string) {
  const row = await env.DB.prepare(
    "SELECT c.id,c.file_id,c.chunk_index,c.heading,c.text,c.token_count,f.name FROM file_chunks c JOIN files f ON f.id=c.file_id WHERE c.id=? AND c.user_id=?",
  ).bind(id, identity.userId).first<FileChunk & { name: string }>();
  await auditRead(env, identity, "get_file_chunk", row ? [row.id] : [], row ? [row.text] : []);
  return row;
}

export async function searchFileChunks(env: Env, identity: Identity, query: string, action = "search") {
  const match = ftsQuery(query);
  if (!match) return [];
  const rows = await env.DB.prepare(
    "SELECT c.id,c.file_id,c.chunk_index,c.heading,substr(c.text,1,300) AS snippet,c.token_count,f.name,bm25(file_chunks_fts) AS score " +
    "FROM file_chunks_fts JOIN file_chunks c ON c.id=file_chunks_fts.chunk_id JOIN files f ON f.id=c.file_id " +
    "WHERE file_chunks_fts MATCH ? AND c.user_id=? ORDER BY score LIMIT 8",
  ).bind(match, identity.userId).all<{ id: string; file_id: string; chunk_index: number; heading: string; snippet: string; token_count: number; name: string; score: number }>();
  await auditRead(env, identity, action, rows.results.map((row) => row.id), rows.results.map((row) => row.snippet));
  return rows.results;
}
