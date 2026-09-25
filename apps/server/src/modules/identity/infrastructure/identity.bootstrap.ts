import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { validateInitialPassword } from "../domain/credentials.js";
import { IdentityRepository } from "./identity.repo.js";
import { hashPassword } from "./password-hasher.js";

// Boot-time password recovery and provisioning (docs/contracts/identity-apikeys.md).
// Only whoever controls the server process environment can use these; the values are never logged.
@Injectable()
export class IdentityBootstrap implements OnModuleInit {
  private readonly logger = new Logger("Identity");

  constructor(private readonly identity: IdentityRepository) {}

  async onModuleInit(): Promise<void> {
    if (process.env.AIGATE_RESET_PASSWORD === "true") {
      await this.identity.clearPasswordAndSessions();
      this.logger.warn("AIGATE_RESET_PASSWORD=true cleared the dashboard password and every session. Set a new password from this machine, then unset the variable.");
      return;
    }
    const initial = process.env.AIGATE_INITIAL_PASSWORD;
    if (initial === undefined || (await this.identity.passwordHash()) !== undefined) return;
    const parsed = validateInitialPassword(initial);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await this.identity.createPassword(await hashPassword(parsed.value))) {
      this.logger.log("Set the dashboard password from AIGATE_INITIAL_PASSWORD.");
    }
  }
}
