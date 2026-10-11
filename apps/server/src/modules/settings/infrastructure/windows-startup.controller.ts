import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { LoginLimiter } from "../../identity/domain/login-limiter.js";
import { IdentityRepository } from "../../identity/infrastructure/identity.repo.js";
import { verifyPassword } from "../../identity/infrastructure/password-hasher.js";
import { WindowsStartup } from "./windows-startup.js";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

@Controller("api/settings/startup")
export class WindowsStartupController {
  private readonly limiter = new LoginLimiter();
  constructor(private readonly startup: WindowsStartup, private readonly identity: IdentityRepository) {}

  @Get() @Header("Cache-Control", "no-store")
  async get() {
    try { return await this.startup.status(); }
    catch { throw new HttpException({ code: "STARTUP_IO_ERROR", message: "Windows Startup status could not be read." }, HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Post() @HttpCode(200) @Header("Cache-Control", "no-store")
  async set(@Body() body: unknown, @Req() request: FastifyRequest) {
    if (!object(body) || Object.keys(body).length !== 2 || typeof body.enabled !== "boolean" || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
      throw new BadRequestException({ code: "STARTUP_INVALID_REQUEST", message: "enabled and current dashboard password are required." });
    }
    const lock = this.limiter.check(request.ip);
    if (lock.locked) throw new HttpException({ code: "RATE_LIMITED", message: "Too many incorrect passwords. Try again shortly." }, HttpStatus.TOO_MANY_REQUESTS);
    const hash = await this.identity.passwordHash();
    if (!hash || !(await verifyPassword(body.password, hash))) {
      this.limiter.fail(request.ip);
      throw new HttpException({ code: "INVALID_CREDENTIALS", message: "The current dashboard password did not match." }, HttpStatus.UNAUTHORIZED);
    }
    this.limiter.succeed(request.ip);
    try { return await this.startup.setEnabled(body.enabled); }
    catch (error) {
      const code = object(error) && typeof error.code === "string" ? error.code : "";
      if (code === "STARTUP_UNSUPPORTED" || code === "STARTUP_CONFLICT") {
        throw new HttpException({ code, message: code === "STARTUP_CONFLICT" ? "The Windows Startup entry changed or belongs to another installation." : "Startup registration is unavailable in this runtime." }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ code: "STARTUP_IO_ERROR", message: "Windows Startup could not be changed." }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
