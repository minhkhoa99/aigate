import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, HttpCode, HttpException,
  HttpStatus, Post, Req, Res, UnauthorizedException,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { parseLogin, parsePasswordChange, parseSetup } from "../domain/credentials.js";
import { LoginLimiter } from "../domain/login-limiter.js";
import { DashboardAuth, isLocal } from "./dashboard-auth.js";
import { IdentityRepository } from "./identity.repo.js";
import { hashPassword, verifyPassword } from "./password-hasher.js";
import { Public } from "./public.decorator.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./session-cookie.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const setupRequired = () => new ConflictException({ code: "SETUP_REQUIRED", message: "Set a dashboard password first" });

// docs/contracts/identity-apikeys.md, "Auth".
@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly auth: DashboardAuth,
    private readonly settings: SettingsRepository,
    private readonly limiter: LoginLimiter,
  ) {}

  @Public()
  @Get("status")
  @Header("Cache-Control", "no-store")
  async status(@Req() request: FastifyRequest) {
    const hash = await this.identity.passwordHash();
    const authenticated = await this.auth.isAuthenticated(request);
    const { requireLogin } = await this.settings.get();
    return { setupRequired: hash === undefined, authenticated, requireLogin };
  }

  @Public()
  @Post("setup")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async setup(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply, @Body() body: unknown) {
    if (!isLocal(request)) throw new ForbiddenException({ code: "NOT_LOCAL", message: "Set the first password from this machine" });
    const parsed = parseSetup(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const alreadySet = new ConflictException({ code: "ALREADY_SET_UP", message: "A dashboard password already exists" });
    if ((await this.identity.passwordHash()) !== undefined) throw alreadySet;
    if (!(await this.identity.createPassword(await hashPassword(parsed.value)))) throw alreadySet;
    setSessionCookie(request, reply, await this.identity.createSession());
    return { ok: true };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async login(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply, @Body() body: unknown) {
    this.refuseIfLocked(request.ip, reply);
    const parsed = parseLogin(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const stored = await this.identity.passwordHash();
    if (stored === undefined) throw setupRequired();
    await this.checkPassword(request.ip, reply, parsed.value, stored);
    setSessionCookie(request, reply, await this.identity.createSession());
    return { ok: true };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = readSessionToken(request);
    if (token) await this.identity.deleteSession(token);
    clearSessionCookie(request, reply);
    return { ok: true };
  }

  // Protected by the global guard. Revokes every session, then signs this client back in.
  @Post("password")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async changePassword(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply, @Body() body: unknown) {
    this.refuseIfLocked(request.ip, reply);
    const parsed = parsePasswordChange(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const stored = await this.identity.passwordHash();
    if (stored === undefined) throw setupRequired();
    await this.checkPassword(request.ip, reply, parsed.value.currentPassword, stored);
    await this.identity.replacePasswordAndRevokeSessions(await hashPassword(parsed.value.newPassword));
    setSessionCookie(request, reply, await this.identity.createSession());
    return { ok: true };
  }

  private refuseIfLocked(client: string, reply: FastifyReply): void {
    const lock = this.limiter.check(client);
    if (lock.locked) throw rateLimited(reply, lock.retryAfterSeconds);
  }

  private async checkPassword(client: string, reply: FastifyReply, password: string, stored: string): Promise<void> {
    if (await verifyPassword(password, stored)) {
      this.limiter.succeed(client);
      return;
    }
    const { remainingBeforeLock } = this.limiter.fail(client);
    const lock = this.limiter.check(client);
    if (lock.locked) throw rateLimited(reply, lock.retryAfterSeconds);
    throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "The password did not match", remainingBeforeLock });
  }
}

function rateLimited(reply: FastifyReply, seconds: number): HttpException {
  reply.header("Retry-After", String(seconds));
  return new HttpException(
    { code: "RATE_LIMITED", message: `Too many failed attempts. Try again in ${seconds}s.`, retryAfter: seconds },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
