import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE = "aigate_session";
export const SESSION_TTL_MS = 24 * 60 * 60_000;
// 32 random bytes in base64url; anything else is rejected before any hashing or lookup.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readSessionToken(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === SESSION_COOKIE && value && TOKEN_PATTERN.test(value)) return value;
  }
  return undefined;
}

function attributes(request: FastifyRequest, maxAgeSeconds: number): string {
  // Secure only when this server terminates TLS itself; forwarded headers are not trusted.
  const secure = request.protocol === "https" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, token: string): void {
  reply.header("set-cookie", `${SESSION_COOKIE}=${token}; ${attributes(request, SESSION_TTL_MS / 1000)}`);
}

export function clearSessionCookie(request: FastifyRequest, reply: FastifyReply): void {
  reply.header("set-cookie", `${SESSION_COOKIE}=; ${attributes(request, 0)}`);
}
