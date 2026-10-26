import { AuthorizationError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { WorkerEntrypoint, env as bindings } from "cloudflare:workers";
import { handleApp } from "./ui.ts";
import { authorizationServerMetadata } from "./oauth-metadata.ts";
import { createServer } from "./tools.ts";
import type { Env, Identity } from "./types.ts";

const publicOrigin = (bindings as unknown as Env).PUBLIC_ORIGIN;

class McpApi extends WorkerEntrypoint<Env, Identity> {
  async fetch(request: Request): Promise<Response> {
    const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const token = bearer ? await this.env.OAUTH_PROVIDER.unwrapToken(bearer) : null;
    if (!token || token.userId !== this.ctx.props.userId) return new Response("Unauthorized", { status: 401 });
    return createMcpHandler(() => createServer(this.env, this.env.PUBLIC_ORIGIN, token.scope), {
      authContext: { props: this.ctx.props },
    })(request, this.env, this.ctx);
  }
}

const app: ExportedHandler<Env> = {
  async fetch(request, env) {
    try {
      // ChatGPT probes the RFC 8414 path scoped to the MCP resource before it
      // opens the authorization page. The provider serves the root form, while
      // this compatibility route returns the same authorization-server metadata.
      if (new URL(request.url).pathname === "/.well-known/oauth-authorization-server/mcp") {
        return authorizationServerMetadata(env.PUBLIC_ORIGIN);
      }
      return await handleApp(request, env);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        if (!error.redirectUri) return new Response(error.description, { status: 400 });
        const redirect = new URL(error.redirectUri);
        redirect.searchParams.set("error", error.code);
        redirect.searchParams.set("error_description", error.description);
        if (error.state) redirect.searchParams.set("state", error.state);
        if (error.issuer) redirect.searchParams.set("iss", error.issuer);
        return Response.redirect(redirect, 302);
      }
      if (error instanceof Error && error.message === "Project, key, and value are required.") {
        return new Response(error.message, { status: 400 });
      }
      return new Response("Nomad could not complete this request.", { status: 500 });
    }
  },
};

export default new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: McpApi,
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: ["mcp:read", "mcp:write"],
  resourceMetadata: {
    resource: `${publicOrigin}/mcp`,
    authorization_servers: publicOrigin.startsWith("https://") ? [publicOrigin] : undefined,
    scopes_supported: ["mcp:read", "mcp:write"],
    resource_name: "Nomad context",
  },
  clientIdMetadataDocumentEnabled: true,
});
