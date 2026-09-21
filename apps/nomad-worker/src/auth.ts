import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import type { Env, Session } from "./types.ts";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION_TTL = 60 * 60 * 24 * 30;
const STATE_TTL = 60 * 10;

interface LoginState {
  nonce: string;
  oauthRequest?: AuthRequest;
}

export function sessionCookieName(url: URL) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" ? "nomad_session" : "__Host-nomad_session";
}

function cookieHeader(url: URL, token: string): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName(url)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}${secure}`;
}

export async function getSession(request: Request, env: Env): Promise<Session | null> {
  const name = sessionCookieName(new URL(request.url));
  const token = request.headers.get("Cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) return null;
  return await env.OAUTH_KV.get<Session>(`nomad:session:${token}`, "json");
}

export function verifyForm(request: Request, session: Session, form: FormData, allowOpaqueOrigin = false): boolean {
  const origin = request.headers.get("Origin");
  const validOrigin = !origin || origin === new URL(request.url).origin || (allowOpaqueOrigin && origin === "null");
  return validOrigin && form.get("csrf") === session.csrf;
}

export async function startGoogle(request: Request, env: Env, oauthRequest?: AuthRequest): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response("Google sign-in is not configured yet.", { status: 503 });
  }
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  await env.OAUTH_KV.put(`nomad:login:${state}`, JSON.stringify({ nonce, oauthRequest } satisfies LoginState), {
    expirationTtl: STATE_TTL,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    access_type: "online",
    prompt: "select_account",
  }).toString();
  return Response.redirect(url, 302);
}

export async function finishGoogle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || !/^[0-9a-f-]{36}$/.test(state)) return new Response("Sign-in failed.", { status: 400 });
  const pending = await env.OAUTH_KV.get<LoginState>(`nomad:login:${state}`, "json");
  if (!pending) return new Response("Sign-in expired. Please try again.", { status: 400 });
  await env.OAUTH_KV.delete(`nomad:login:${state}`);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return new Response("Google sign-in could not be completed.", { status: 502 });
  const token = await tokenResponse.json() as { id_token?: string };
  if (!token.id_token) return new Response("Google did not provide an identity token.", { status: 502 });
  const { payload } = await jwtVerify(token.id_token, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== pending.nonce || payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub) {
    return new Response("Google identity verification failed.", { status: 403 });
  }
  const newUserId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users(id,google_sub,email) VALUES(?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email",
  ).bind(newUserId, payload.sub, payload.email).run();
  const user = await env.DB.prepare("SELECT id FROM users WHERE google_sub=?").bind(payload.sub).first<{ id: string }>();
  if (!user) throw new Error("User creation failed.");
  const sessionToken = crypto.randomUUID();
  const session: Session = { userId: user.id, csrf: crypto.randomUUID() };
  await env.OAUTH_KV.put(`nomad:session:${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });

  let destination = "/";
  if (pending.oauthRequest) {
    const ticket = crypto.randomUUID();
    await env.OAUTH_KV.put(`nomad:consent:${ticket}`, JSON.stringify({ userId: user.id, request: pending.oauthRequest }), {
      expirationTtl: STATE_TTL,
    });
    destination = `/consent?ticket=${ticket}`;
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `${url.origin}${destination}`, "Set-Cookie": cookieHeader(url, sessionToken) },
  });
}
