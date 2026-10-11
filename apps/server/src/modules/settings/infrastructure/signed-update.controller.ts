import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { LoginLimiter } from "../../identity/domain/login-limiter.js";
import { IdentityRepository } from "../../identity/infrastructure/identity.repo.js";
import { verifyPassword } from "../../identity/infrastructure/password-hasher.js";
import { SignedUpdate } from "./signed-update.js";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

@Controller("api/settings/update")
export class SignedUpdateController {
  private readonly limiter = new LoginLimiter();
  constructor(private readonly updates: SignedUpdate, private readonly identity: IdentityRepository) {}

  @Get() @Header("Cache-Control", "no-store")
  get() { return this.updates.status(); }

  @Post("check") @HttpCode(200) @Header("Cache-Control", "no-store")
  async check(@Body() body: unknown, @Req() request: FastifyRequest) {
    if (body !== undefined) throw new BadRequestException({ code: "UPDATE_INVALID_REQUEST", message: "The update check does not accept a request body." });
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.raw.on("aborted", onAbort);
    request.raw.socket.on("close", onAbort);
    const deadline = setTimeout(() => controller.abort(), 5000);
    try { return await this.updates.check(controller.signal); }
    catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "UPDATE_CHECK_FAILED";
      const status = code === "UPDATE_CHANNEL_UNCONFIGURED" || code === "UPDATE_CHANNEL_INVALID" || code === "UPDATE_BUSY" ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY;
      throw new HttpException({ code, message: error instanceof Error ? error.message : "The release channel could not be checked." }, status);
    } finally { clearTimeout(deadline); request.raw.off("aborted", onAbort); request.raw.socket.off("close", onAbort); }
  }

  private async authorize(body: unknown, request: FastifyRequest, stage: boolean): Promise<string | null> {
    if (!object(body) || Object.keys(body).sort().join(",") !== (stage ? "expectedVersion,password" : "password") ||
      typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256 ||
      stage && (typeof body.expectedVersion !== "string" || body.expectedVersion.length < 1 || body.expectedVersion.length > 128)) {
      throw new BadRequestException({ code: "UPDATE_INVALID_REQUEST", message: "Current password and a checked version are required." });
    }
    const lock = this.limiter.check(request.ip);
    if (lock.locked) throw new HttpException({ code: "RATE_LIMITED", message: "Too many incorrect passwords. Try again shortly." }, HttpStatus.TOO_MANY_REQUESTS);
    const hash = await this.identity.passwordHash();
    if (!hash || !(await verifyPassword(body.password, hash))) {
      this.limiter.fail(request.ip);
      throw new HttpException({ code: "INVALID_CREDENTIALS", message: "The current dashboard password did not match." }, HttpStatus.UNAUTHORIZED);
    }
    this.limiter.succeed(request.ip);
    if (stage && typeof body.expectedVersion === "string") return body.expectedVersion;
    return null;
  }

  private failure(error: unknown): HttpException {
    const code = object(error) && typeof error.code === "string" ? error.code : "UPDATE_INSTALL_FAILED";
    const conflict = ["UPDATE_NOT_MANAGED", "UPDATE_BUSY", "UPDATE_STALE", "UPDATE_ALREADY_STAGED", "UPDATE_NO_ROLLBACK", "UPDATE_CHANNEL_INVALID"];
    const status = conflict.includes(code) ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY;
    return new HttpException({ code, message: error instanceof Error ? error.message : "The release could not be prepared." }, status);
  }

  @Post("stage") @HttpCode(200) @Header("Cache-Control", "no-store")
  async stage(@Body() body: unknown, @Req() request: FastifyRequest) {
    const expectedVersion = await this.authorize(body, request, true);
    if (expectedVersion === null) throw new BadRequestException({ code: "UPDATE_INVALID_REQUEST", message: "A checked version is required." });
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.raw.on("aborted", onAbort);
    request.raw.socket.on("close", onAbort);
    const deadline = setTimeout(() => controller.abort(), 300_000);
    try { return await this.updates.stage(expectedVersion, controller.signal); }
    catch (error) { throw this.failure(error); }
    finally { clearTimeout(deadline); request.raw.off("aborted", onAbort); request.raw.socket.off("close", onAbort); }
  }

  @Post("rollback") @HttpCode(200) @Header("Cache-Control", "no-store")
  async rollback(@Body() body: unknown, @Req() request: FastifyRequest) {
    await this.authorize(body, request, false);
    try { return await this.updates.rollback(); }
    catch (error) { throw this.failure(error); }
  }
}
