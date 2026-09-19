import assert from "node:assert/strict";

const origin = (process.env.NOMAD_ORIGIN ?? "").replace(/\/$/, "");
assert.ok(origin.startsWith("https://"), "NOMAD_ORIGIN must be an HTTPS origin");

async function get(path) {
  return fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
}

const healthResponse = await get("/health");
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.status, "ok");
assert.equal(health.phase, "M8");
if (process.env.EXPECTED_ENVIRONMENT) assert.equal(health.environment, process.env.EXPECTED_ENVIRONMENT);

for (const path of ["/welcome", "/privacy", "/terms", "/setup"]) {
  const response = await get(path);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
}

const mcp = await get("/mcp");
assert.equal(mcp.status, 401, `/mcp returned ${mcp.status} without a token`);

console.log(`Nomad smoke check passed for ${origin} (${health.environment}, ${health.release}).`);
