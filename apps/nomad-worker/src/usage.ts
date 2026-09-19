import type { Env } from "./types.ts";

const GB = 1024 * 1024 * 1024;

export const warningLimits = {
  workers_requests: 80_000,
  d1_reads: 4_000_000,
  d1_writes: 80_000,
  d1_storage_bytes: 4 * GB,
  r2_class_a: 800_000,
  r2_class_b: 8_000_000,
  r2_storage_bytes: 8 * GB,
} as const;

export type UsageKind = keyof typeof warningLimits;

export async function recordUsage(env: Env, userId: string | null, kind: UsageKind, amount = 1) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Usage amount must be a positive integer.");
  await env.DB.prepare("INSERT INTO usage_events(id,user_id,kind,amount) VALUES(?,?,?,?)")
    .bind(crypto.randomUUID(), userId, kind, amount).run();
}

export async function getUsageState(env: Env, userId?: string) {
  const rows = await env.DB.prepare(
    "SELECT kind,SUM(amount) AS amount FROM usage_events WHERE created_at>=date('now') AND (? IS NULL OR user_id=? OR user_id IS NULL) GROUP BY kind",
  ).bind(userId ?? null, userId ?? null).all<{ kind: UsageKind; amount: number }>();
  const totals = Object.fromEntries(Object.keys(warningLimits).map((kind) => [kind, 0])) as Record<UsageKind, number>;
  for (const row of rows.results) if (row.kind in totals) totals[row.kind] = row.amount;
  const warnings = (Object.entries(warningLimits) as Array<[UsageKind, number]>)
    .filter(([kind, limit]) => totals[kind] >= limit)
    .map(([kind, limit]) => ({ kind, amount: totals[kind], limit }));
  return {
    totals,
    limits: warningLimits,
    warnings,
    read_only: warnings.some((warning) => ["workers_requests", "d1_writes", "d1_storage_bytes"].includes(warning.kind)),
  };
}
