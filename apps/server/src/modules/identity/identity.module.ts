import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { SettingsModule } from "../settings/settings.module.js";
import { LoginLimiter } from "./domain/login-limiter.js";
import { AuthController } from "./infrastructure/auth.controller.js";
import { DashboardAuth } from "./infrastructure/dashboard-auth.js";
import { DashboardAuthGuard } from "./infrastructure/dashboard-auth.guard.js";
import { IdentityBootstrap } from "./infrastructure/identity.bootstrap.js";
import { IdentityRepository } from "./infrastructure/identity.repo.js";

@Module({
  imports: [SettingsModule],
  controllers: [AuthController],
  providers: [
    IdentityRepository,
    DashboardAuth,
    IdentityBootstrap,
    // A factory, so every application instance gets its own lockout state.
    { provide: LoginLimiter, useFactory: () => new LoginLimiter() },
    // Deny by default: every route needs a session unless it is marked @Public().
    { provide: APP_GUARD, useClass: DashboardAuthGuard },
  ],
})
export class IdentityModule {}
