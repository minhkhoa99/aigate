import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { SignedUpdate } from "./signed-update.js";

@Controller("api/settings/update")
export class SignedUpdateController {
  constructor(private readonly updates: SignedUpdate) {}

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
}
