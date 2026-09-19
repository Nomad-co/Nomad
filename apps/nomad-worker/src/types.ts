import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  FILES: R2Bucket;
  OAUTH_PROVIDER: OAuthHelpers;
  USER_RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  GLOBAL_RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  PUBLIC_ORIGIN: string;
  ENVIRONMENT?: string;
  RELEASE?: string;
  SUPPORT_EMAIL?: string;
  READ_ONLY_MODE?: string;
}

export interface Identity {
  [key: string]: unknown;
  userId: string;
  clientId: string;
}

export interface Session {
  userId: string;
  csrf: string;
}

export interface Field {
  id: string;
  user_id: string;
  project: string;
  key: string;
  value: string;
  sensitivity: "normal" | "sensitive" | "sealed";
  version: number;
  updated_at: string;
  source_client_id: string | null;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_id: string;
  field_id: string;
  proposed_value: string;
  reason: string;
  base_version: number;
  status: "pending" | "applied" | "rejected" | "superseded";
}
