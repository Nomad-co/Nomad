# Nomad M1 diagnostic Worker

This public, unauthenticated MCP endpoint tests whether an assistant can call Nomad. Its single read-only tool, nomad_probe, returns a fresh request ID and UTC timestamp. It reads no personal context, stores nothing, and calls no model API. Do not put personal data in its optional challenge.

## Run locally

Use Node.js 22 or later and pnpm:

    pnpm install
    pnpm typecheck
    pnpm dev

In another terminal:

    pnpm test:mcp

The local endpoint is http://localhost:8787/mcp. The test checks MCP initialization, tool discovery, the read-only annotation, 20 fresh tool calls, and invalid input. Its p50/p95 numbers measure HTTP tool-call latency from the test machine; they are not assistant latency.

## Test the deployed endpoint

The deployed URL is https://nomad-mcp-feasibility.nomad-mcp-feasibility.workers.dev/mcp. To rerun the public protocol test:

    NOMAD_MCP_URL=https://nomad-mcp-feasibility.nomad-mcp-feasibility.workers.dev/mcp pnpm test:mcp

To deploy a code change after signing in to the owner's Cloudflare account:

    pnpm deploy

The diagnostic endpoint must remain data-free. User-specific context requires authentication and authorization in a later milestone.

## Assistant client verification

The M1 web gate passed with live calls and 20 timed results from each web client. To repeat it, connect the public URL to ChatGPT developer mode and Claude, call `nomad_probe` in a real conversation, inspect the tool result, and measure client-side latency. Choose No authentication/None in ChatGPT for this data-free test; choosing OAuth will fail because the Worker has no OAuth routes. Claude mobile is an untested result-table cell, not an M1 exit criterion. The prompts, raw measurements, and go/no-go decision are in [M1_FEASIBILITY.md](../../docs/M1_FEASIBILITY.md).
