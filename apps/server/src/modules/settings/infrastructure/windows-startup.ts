import { lstat, link, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { isAbsolute, join } from "node:path";

export interface StartupConfig {
  platform: string;
  appData?: string;
  nodePath: string;
  serverEntry: string;
  webIndex: string;
  secretKeyOverride: boolean;
}

export type StartupReason = "WINDOWS_ONLY" | "APPDATA_UNAVAILABLE" | "STARTUP_FOLDER_MISSING" | "BUILD_REQUIRED" | "SECRET_KEY_OVERRIDE" | "STARTUP_CONFLICT";
export interface StartupStatus { supported: boolean; enabled: boolean; reason: StartupReason | null }
const MAX_SCRIPT_BYTES = 4 * 1024;
const missing = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
const coded = (code: string, message: string) => Object.assign(new Error(message), { code });
const vb = (value: string) => `"${value.replaceAll('"', '""')}"`;

export class WindowsStartup {
  constructor(private readonly config: StartupConfig) {}

  private folder() {
    return join(this.config.appData ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  }

  private target() { return join(this.folder(), "AIGate-startup.vbs"); }

  private script() {
    const command = `"${this.config.nodePath}" "${this.config.serverEntry}"`;
    return `' AIGate startup v1\r\nSet shell = CreateObject("WScript.Shell")\r\nshell.Run ${vb(command)}, 0, False\r\n`;
  }

  private async regular(path: string): Promise<boolean> {
    try { return (await lstat(path)).isFile(); }
    catch (error) { if (missing(error)) return false; throw error; }
  }

  private async owned(): Promise<"missing" | "owned" | "foreign"> {
    try {
      const info = await lstat(this.target());
      if (!info.isFile() || info.size > MAX_SCRIPT_BYTES) return "foreign";
      return await readFile(this.target(), "utf8") === this.script() ? "owned" : "foreign";
    } catch (error) { if (missing(error)) return "missing"; throw error; }
  }

  async status(): Promise<StartupStatus> {
    if (this.config.platform !== "win32") return { supported: false, enabled: false, reason: "WINDOWS_ONLY" };
    if (!this.config.appData || !isAbsolute(this.config.appData)) return { supported: false, enabled: false, reason: "APPDATA_UNAVAILABLE" };
    let folder;
    try { folder = await lstat(this.folder()); }
    catch (error) { if (missing(error)) return { supported: false, enabled: false, reason: "STARTUP_FOLDER_MISSING" }; throw error; }
    if (!folder.isDirectory()) return { supported: false, enabled: false, reason: "STARTUP_CONFLICT" };
    const owned = await this.owned();
    if (owned === "foreign") return { supported: false, enabled: false, reason: "STARTUP_CONFLICT" };
    if (this.config.secretKeyOverride) return { supported: false, enabled: owned === "owned", reason: "SECRET_KEY_OVERRIDE" };
    if (!(await this.regular(this.config.nodePath)) || !(await this.regular(this.config.serverEntry)) || !(await this.regular(this.config.webIndex))) {
      return { supported: false, enabled: owned === "owned", reason: "BUILD_REQUIRED" };
    }
    return { supported: true, enabled: owned === "owned", reason: null };
  }

  async setEnabled(enabled: boolean): Promise<StartupStatus> {
    const current = await this.status();
    if (current.reason === "STARTUP_CONFLICT") throw coded("STARTUP_CONFLICT", "The Windows Startup entry belongs to another installation or was changed.");
    if (enabled) {
      if (!current.supported) throw coded("STARTUP_UNSUPPORTED", current.reason ?? "Startup registration is unavailable.");
      if (!current.enabled) {
        const temporary = `${this.target()}.${randomBytes(8).toString("hex")}.tmp`;
        try {
          await writeFile(temporary, this.script(), { encoding: "utf8", flag: "wx", mode: 0o600 });
          await link(temporary, this.target());
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") throw coded("STARTUP_CONFLICT", "A Startup entry appeared during registration.");
          throw error;
        } finally { await unlink(temporary).catch(error => { if (!missing(error)) throw error; }); }
      }
    } else if (current.enabled) await unlink(this.target());
    return this.status();
  }
}
