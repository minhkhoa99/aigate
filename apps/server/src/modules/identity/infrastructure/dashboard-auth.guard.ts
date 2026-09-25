import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { DashboardAuth } from "./dashboard-auth.js";
import { IS_PUBLIC } from "./public.decorator.js";

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: DashboardAuth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    if (await this.auth.isAuthenticated(context.switchToHttp().getRequest<FastifyRequest>())) return true;
    throw new UnauthorizedException({ code: "UNAUTHENTICATED", message: "Sign in to use the management API" });
  }
}
