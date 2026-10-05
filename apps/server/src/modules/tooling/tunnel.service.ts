import { execFile } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ApiKeysRepository } from "../apikeys/infrastructure/api-keys.repo.js";
import { IdentityRepository } from "../identity/infrastructure/identity.repo.js";
import { SettingsRepository } from "../settings/infrastructure/settings.repo.js";

const run = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;
const MAX_OUTPUT = 64 * 1024;
const publicUrl = (output: string) => output.match(/https:\/\/[a-z0-9-]+\.[a-z0-9.-]+\.ts\.net(?::\d+)?/i)?.[0] ?? null;

@Injectable()
export class TunnelService {
  constructor(private readonly settings: SettingsRepository, private readonly identity: IdentityRepository, private readonly keys: ApiKeysRepository) {}

  async status() {
    const installed = this.available();
    const access = await this.accessStatus();
    if (!installed) return { installed: false, enabled: false, running: false, publicUrl: null, accessReady: access.ready, blockedReason: access.reason };
    const result = await this.call(["funnel", "status"]);
    const target = `http://127.0.0.1:${this.port()}`;
    const url = publicUrl(result.output);
    const running = result.ok && Boolean(url && result.output.includes(target));
    const routeConflict = result.ok && Boolean(url && !running);
    return { installed: true, enabled: running, running, publicUrl: running ? url : null, routeConflict, accessReady: access.ready, blockedReason: routeConflict ? "Another Funnel route is already using this Tailscale host. Disable or change it in Tailscale before enabling AIGate." : access.reason };
  }

  async enable() {
    const access = await this.accessStatus();
    if (!access.ready) throw new ForbiddenException({ code: "TUNNEL_SECURITY_REQUIRED", message: access.reason ?? "Secure dashboard login and API-key checks before exposing the gateway." });
    if (!this.available()) throw new ServiceUnavailableException({ code: "TUNNEL_NOT_INSTALLED", message: "Install and sign in to Tailscale on the AIGate host, then retry." });
    const current = await this.call(["funnel", "status"]);
    const target = `http://127.0.0.1:${this.port()}`;
    if (!current.ok || publicUrl(current.output) && !current.output.includes(target)) throw new ConflictException({ code: "TUNNEL_ROUTE_CONFLICT", message: "Another Funnel route is active or its status could not be verified. Review Tailscale Funnel before enabling AIGate." });
    const result = await this.call(["funnel", "--https=443", "--bg", "--yes", target]);
    if (!result.ok) throw new ServiceUnavailableException({ code: "TUNNEL_START_FAILED", message: "Tailscale could not enable Funnel. Confirm the daemon is signed in and Funnel is allowed by tailnet policy." });
    return this.status();
  }

  async disable() {
    if (!this.available()) return { success: true, enabled: false };
    const result = await this.call(["funnel", "--https=443", `http://127.0.0.1:${this.port()}`, "off"]);
    if (!result.ok) throw new ServiceUnavailableException({ code: "TUNNEL_STOP_FAILED", message: "Tailscale could not disable this Funnel route." });
    return { success: true, enabled: false };
  }

  private async accessStatus(): Promise<{ ready: boolean; reason: string | null }> {
    const settings = await this.settings.get();
    if (!settings.requireLogin || !(await this.identity.passwordHash())) return { ready: false, reason: "Set a dashboard password and require sign-in before enabling public access." };
    if (!settings.requireApiKey || !(await this.keys.list()).some((key) => key.isActive)) return { ready: false, reason: "Require API keys and create at least one active key before enabling public access." };
    return { ready: true, reason: null };
  }

  private port(): number {
    const port = Number(process.env.PORT ?? 20200);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 20200;
  }

  private available(): boolean {
    const paths = (process.env.PATH ?? "").split(delimiter);
    const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
    return paths.some((directory) => extensions.some((ext) => this.executable(join(directory, `tailscale${ext}`)) || this.executable(join(directory, `tailscale${ext.toLowerCase()}`))));
  }

  private executable(path: string): boolean {
    try { if (!statSync(path).isFile()) return false; if (process.platform !== "win32") accessSync(path, constants.X_OK); return true; } catch { return false; }
  }

  private async call(args: string[]): Promise<{ ok: boolean; output: string }> {
    try {
      const result = await run("tailscale", args, { timeout: COMMAND_TIMEOUT_MS, windowsHide: true, maxBuffer: MAX_OUTPUT });
      return { ok: true, output: `${result.stdout}\n${result.stderr}`.slice(0, MAX_OUTPUT) };
    } catch (error) {
      const row = typeof error === "object" && error !== null ? Object.fromEntries(Object.entries(error)) : {};
      return { ok: false, output: `${String(row.stdout ?? "")}\n${String(row.stderr ?? "")}`.slice(0, MAX_OUTPUT) };
    }
  }
}
