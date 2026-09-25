import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { isLocalRequest } from "../domain/local-request.js";
import { IdentityRepository } from "./identity.repo.js";
import { readSessionToken } from "./session-cookie.js";

export const isLocal = (request: FastifyRequest) =>
  isLocalRequest({ ip: request.ip, host: request.headers.host, origin: request.headers.origin });

// Who may use the management API (docs/contracts/identity-apikeys.md, "Access to /api/*").
@Injectable()
export class DashboardAuth {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async isAuthenticated(request: FastifyRequest): Promise<boolean> {
    const token = readSessionToken(request);
    if (token && (await this.identity.isSessionValid(token))) return true;
    // requireLogin=false exempts local clients only; 9router exempted every caller (SUSPECTED_BUG).
    return isLocal(request) && !(await this.settings.get()).requireLogin;
  }
}
