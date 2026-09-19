import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({ name: "nomad-feasibility", version: "0.1.0" });

  server.registerTool(
    "nomad_probe",
    {
      title: "Verify Nomad connection",
      description:
        "Use this when the user asks whether Nomad is connected. This diagnostic tool reads no personal context and changes nothing.",
      inputSchema: {
        challenge: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9 _-]+$/).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ challenge }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            service: "nomad",
            phase: "M1-connectivity-test",
            message: "Nomad MCP is reachable",
            challenge: challenge ?? null,
            requestId: crypto.randomUUID(),
            serverTime: new Date().toISOString(),
          }),
        },
      ],
    }),
  );

  return server;
}

const mcp = createMcpHandler(createServer);

export default {
  fetch(request: Request, env: unknown, context: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok", phase: "M1-connectivity-test" });
    }
    if (pathname === "/mcp") return mcp(request, env, context);
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
