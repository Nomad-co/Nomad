import assert from "node:assert/strict";

const url = process.env.NOMAD_MCP_URL ?? "http://localhost:8787/mcp";

async function call(id, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, `${method} returned HTTP ${response.status}`);
  const body = await response.text();
  const data = response.headers.get("content-type")?.includes("text/event-stream")
    ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
    : body;
  assert.ok(data, `${method} returned no MCP message`);
  const message = JSON.parse(data);
  assert.equal(message.id, id);
  return message;
}

const initialized = await call(1, "initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "nomad-m1-check", version: "0.1.0" },
});
assert.equal(initialized.result.serverInfo.name, "nomad-feasibility");

const listed = await call(2, "tools/list");
assert.deepEqual(listed.result.tools.map((tool) => tool.name), ["nomad_probe"]);
assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);

const latencies = [];
const requestIds = new Set();
let result;
for (let id = 3; id < 23; id++) {
  const start = performance.now();
  const probe = await call(id, "tools/call", {
    name: "nomad_probe",
    arguments: { challenge: "M1 connection check" },
  });
  latencies.push(performance.now() - start);
  result = JSON.parse(probe.result.content[0].text);
  assert.equal(result.service, "nomad");
  assert.equal(result.message, "Nomad MCP is reachable");
  assert.equal(result.challenge, "M1 connection check");
  assert.match(result.requestId, /^[0-9a-f-]{36}$/i);
  assert.ok(Number.isFinite(Date.parse(result.serverTime)));
  assert.equal(requestIds.has(result.requestId), false, "request ID was reused");
  requestIds.add(result.requestId);
}

const invalid = await call(23, "tools/call", {
  name: "nomad_probe",
  arguments: { challenge: "x".repeat(81) },
});
assert.equal(invalid.result.isError, true);

latencies.sort((a, b) => a - b);
const percentile = (fraction) => latencies[Math.ceil(fraction * latencies.length) - 1].toFixed(1);
console.log(`M1 MCP check passed: ${url}`);
console.log(`Probe request ID: ${result.requestId}; server time: ${result.serverTime}`);
console.log(`HTTP tool-call latency, 20 sequential samples: p50 ${percentile(0.5)} ms; p95 ${percentile(0.95)} ms`);
