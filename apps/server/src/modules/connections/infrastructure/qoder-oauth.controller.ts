import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Body, Controller, Delete, Header, HttpCode, HttpException, Inject, Param, Post, Req, Res, type OnModuleDestroy } from "@nestjs/common";
import { createQoderDeviceAttempt, EngineError, pollQoderDevice, type HttpTransportPort, type OAuthTokens, type QoderDeviceAttempt } from "@aigate/engine";
import type { FastifyReply, FastifyRequest } from "fastify";
import { readSessionToken } from "../../identity/infrastructure/session-cookie.js";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";
import { ConnectionsRepository } from "./connections.repo.js";

const COOKIE = "aigate_qoder_flow";
const TTL_MS = 5 * 60_000;
function fail(code: string, status = 400): never { throw new HttpException({ code, message: code }, status); }
type Saved = { success: true; connection: { id: string; provider: string; email: string | null } };
type Attempt = {
  id: string; owner: string; expiresAt: number; controller: AbortController; timer: NodeJS.Timeout;
  device?: QoderDeviceAttempt; tokens?: OAuthTokens; tokenExpiresAt?: number;
  account?: { id: string; name?: string; email?: string };
  status: "pending" | "approved" | "failed"; polls: number; nextPoll: number; polling: boolean; saved?: Promise<Saved>;
};

// Separate from the legacy OAuth exchange: the browser never receives a verifier or a candidate token.
@Controller("api/oauth/qoder/attempts")
export class QoderOAuthController implements OnModuleDestroy {
  private readonly attempts = new Map<string, Attempt>();

  constructor(
    private readonly connections: ConnectionsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  onModuleDestroy(): void {
    for (const attempt of this.attempts.values()) this.release(attempt);
    this.attempts.clear();
  }

  private release(attempt: Attempt): void {
    clearTimeout(attempt.timer);
    attempt.controller.abort();
    delete attempt.device;
    delete attempt.tokens;
  }

  private owner(request: FastifyRequest, reply?: FastifyReply): string {
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== `${request.protocol}://${request.headers.host}`) fail("INVALID_REQUEST", 403);
    let token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      if (!reply) fail("QODER_ATTEMPT_NOT_FOUND", 404);
      token = randomBytes(32).toString("base64url");
      reply.header("set-cookie", `${COOKIE}=${token}; Path=/api/oauth/qoder; HttpOnly; SameSite=Strict; Max-Age=600${request.protocol === "https" ? "; Secure" : ""}`);
    }
    return createHash("sha256").update(`${token}:${readSessionToken(request) ?? "local"}`).digest("hex");
  }

  private owned(id: string, request: FastifyRequest): Attempt {
    const owner = this.owner(request);
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.owner !== owner) fail("QODER_ATTEMPT_NOT_FOUND", 404);
    if (Date.now() >= attempt.expiresAt) { this.release(attempt); fail("QODER_ATTEMPT_EXPIRED", 410); }
    return attempt;
  }

  @Post()
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  async start(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    if (body !== undefined && (typeof body !== "object" || body === null || Array.isArray(body))) fail("INVALID_REQUEST");
    const fields = body ?? {};
    const clientId: unknown = Reflect.get(fields, "clientId");
    if (Object.keys(fields).some((key) => key !== "clientId") || clientId !== undefined && (typeof clientId !== "string" || !/^[\x21-\x7e]{1,256}$/.test(clientId))) fail("INVALID_REQUEST");
    const owner = this.owner(request, reply);
    for (const attempt of this.attempts.values()) if (Date.now() >= attempt.expiresAt) { this.release(attempt); this.attempts.delete(attempt.id); }
    if (this.attempts.size >= 16 || [...this.attempts.values()].filter((attempt) => attempt.owner === owner).length >= 2) fail("QODER_ATTEMPT_LIMIT", 429);
    // Reserve before PKCE's async digest, so simultaneous starts cannot exceed the bounds.
    const id = randomUUID();
    const expiresAt = Date.now() + TTL_MS;
    const attempt: Attempt = { id, owner, expiresAt, controller: new AbortController(), timer: setTimeout(() => this.release(attempt), TTL_MS), status: "pending", polls: 0, nextPoll: 0, polling: false };
    attempt.timer.unref();
    this.attempts.set(id, attempt);
    try {
      const device = await createQoderDeviceAttempt(typeof clientId === "string" ? clientId : undefined);
      if (attempt.controller.signal.aborted) fail("QODER_ATTEMPT_EXPIRED", 410);
      attempt.device = device;
      return { id, authUrl: device.authUrl, expiresAt: new Date(expiresAt).toISOString(), interval: 2, status: "pending" };
    } catch (error) { this.release(attempt); this.attempts.delete(id); throw error; }
  }

  @Post(":id/poll")
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  async poll(@Param("id") id: string, @Req() request: FastifyRequest) {
    const attempt = this.owned(id, request);
    if (attempt.status === "approved") return this.view(attempt);
    if (attempt.status === "failed" || !attempt.device) fail("QODER_AUTH_FAILED", 502);
    if (attempt.polling || Date.now() < attempt.nextPoll) fail("QODER_POLL_TOO_FAST", 429);
    if (attempt.polls >= 150) { this.release(attempt); fail("QODER_ATTEMPT_EXPIRED", 410); }
    attempt.polling = true; attempt.polls++; attempt.nextPoll = Date.now() + 2000;
    const disconnected = () => attempt.controller.abort();
    request.raw.once("aborted", disconnected);
    try {
      const result = await pollQoderDevice(attempt.device, { transport: this.transport, ctx: { signal: attempt.controller.signal, requestId: randomUUID() } });
      if (attempt.controller.signal.aborted || Date.now() >= attempt.expiresAt) fail("QODER_ATTEMPT_EXPIRED", 410);
      if (result.status === "pending") return { id, status: "pending" };
      if (result.status !== "approved") fail("QODER_AUTH_FAILED", 502);
      attempt.tokens = result.tokens;
      attempt.account = { id: result.tokens.data.userId!, ...(result.tokens.displayName ? { name: result.tokens.displayName } : {}), ...(result.tokens.email ? { email: result.tokens.email } : {}) };
      attempt.tokenExpiresAt = result.tokens.expiresIn === undefined ? undefined : Date.now() + result.tokens.expiresIn * 1000;
      attempt.status = "approved";
      delete attempt.device;
      return this.view(attempt);
    } catch (error) {
      attempt.status = "failed"; this.release(attempt);
      if (error instanceof HttpException) throw error;
      const code = error instanceof EngineError && typeof error.details.code === "string" ? error.details.code : "QODER_PROTOCOL_ERROR";
      fail(code, 502);
    } finally { attempt.polling = false; request.raw.removeListener("aborted", disconnected); }
  }

  private view(attempt: Attempt) {
    return { id: attempt.id, status: "approved", account: attempt.account, expiresAt: attempt.tokenExpiresAt === undefined ? null : new Date(attempt.tokenExpiresAt).toISOString() };
  }

  @Post(":id/confirm")
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  confirm(@Param("id") id: string, @Req() request: FastifyRequest): Promise<Saved> {
    const attempt = this.owned(id, request);
    if (attempt.saved) return attempt.saved;
    if (attempt.status !== "approved" || !attempt.tokens) fail("QODER_NOT_APPROVED", 409);
    const tokens = { ...attempt.tokens, ...(attempt.tokenExpiresAt === undefined ? {} : { expiresIn: (attempt.tokenExpiresAt - Date.now()) / 1000 }) };
    if (tokens.expiresIn !== undefined && tokens.expiresIn <= 0) { this.release(attempt); fail("QODER_AUTH_FAILED", 410); }
    attempt.saved = this.connections.saveOAuth({ provider: "qoder", name: tokens.displayName ?? tokens.email ?? "Qoder", tokens, signal: attempt.controller.signal }).then((view): Saved => {
      if (view === "conflict") fail("QODER_ATTEMPT_LIMIT", 409);
      this.release(attempt);
      return { success: true, connection: { id: view.id, provider: view.provider, email: view.email } };
    }).catch((error: unknown) => { delete attempt.saved; throw error; });
    return attempt.saved;
  }

  @Delete(":id")
  @Header("Cache-Control", "no-store")
  @HttpCode(204)
  cancel(@Param("id") id: string, @Req() request: FastifyRequest): void {
    const attempt = this.owned(id, request);
    this.release(attempt); this.attempts.delete(id);
  }
}
