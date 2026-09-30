import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Inject, Injectable, Logger } from "@nestjs/common";

export const PXPIPE_DATA_DIR = Symbol("PXPIPE_DATA_DIR");
const INSTALL_TIMEOUT_MS = 300_000;
const MAX_BODY_BYTES = 16 * 1024 * 1024;

type PxpipeTransform = (input: { body: Uint8Array; model: string }) => Promise<{ body: Uint8Array; applied: boolean }>;
const isPxpipeTransform = (value: unknown): value is PxpipeTransform => typeof value === "function";

@Injectable()
export class PxpipeService {
  private readonly logger = new Logger("PXPIPE");
  private readonly directory: string;
  private transform?: PxpipeTransform;
  private installing?: Promise<void>;

  constructor(@Inject(PXPIPE_DATA_DIR) dataDir: string) {
    this.directory = join(dataDir, "pxpipe");
  }

  async status() {
    try {
      const pkg = JSON.parse(await readFile(join(this.directory, "node_modules", "pxpipe-proxy", "package.json"), "utf8"));
      await this.load();
      return { installed: true, loaded: Boolean(this.transform), installing: Boolean(this.installing), version: typeof pkg.version === "string" ? pkg.version : null };
    } catch {
      return { installed: false, loaded: false, installing: Boolean(this.installing), version: null };
    }
  }

  async install() {
    if (!this.installing) this.installing = this.runInstall();
    try {
      await this.installing;
      if (!(await this.load())) throw new Error("pxpipe-proxy installed but its public transform export could not be loaded");
    } finally {
      this.installing = undefined;
    }
    return this.status();
  }

  async load(): Promise<boolean> {
    if (this.transform) return true;
    try {
      const packageDir = join(this.directory, "node_modules", "pxpipe-proxy");
      const pkg = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
      const entry = pkg.exports?.["./transform"]?.import;
      if (typeof entry !== "string" || !entry.startsWith("./")) return false;
      const path = resolve(packageDir, entry);
      if (!isAbsolute(path) || !path.startsWith(resolve(packageDir) + sep)) return false;
      const module = await import(pathToFileURL(path).href);
      if (!isPxpipeTransform(module.transformAnthropicMessages)) return false;
      this.transform = module.transformAnthropicMessages;
      return true;
    } catch (error) {
      this.logger.warn("PXPIPE unavailable: " + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  async apply(body: string, model: string, minChars: number, timeoutMs: number): Promise<string> {
    try {
      const fn = this.transform ?? (await this.load(), this.transform);
      if (!fn || body.length < minChars || Buffer.byteLength(body) > MAX_BODY_BYTES) return body;
      let timer: NodeJS.Timeout | undefined;
      const result = await Promise.race([
        fn({ body: Buffer.from(body), model }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("PXPIPE timed out")), timeoutMs); }),
      ]).finally(() => clearTimeout(timer));
      return result.applied && result.body instanceof Uint8Array ? Buffer.from(result.body).toString("utf8") : body;
    } catch (error) {
      this.logger.warn("PXPIPE skipped: " + (error instanceof Error ? error.message : String(error)));
      return body;
    }
  }

  private async runInstall(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await new Promise<void>((resolveInstall, rejectInstall) => {
      const windows = process.platform === "win32";
      const child = spawn(windows ? "npm.cmd" : "npm", ["install", "--prefix", this.directory, "--no-save", "--no-audit", "--no-fund", "pxpipe-proxy"], {
        windowsHide: true, shell: windows, stdio: ["ignore", "ignore", "pipe"],
      });
      let tail = "";
      child.stderr?.on("data", (chunk: Buffer) => { tail = (tail + chunk.toString()).slice(-4_000); });
      const timer = setTimeout(() => child.kill(), INSTALL_TIMEOUT_MS);
      child.once("error", (error) => { clearTimeout(timer); rejectInstall(error); });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolveInstall();
        else rejectInstall(new Error("npm install failed" + (tail ? ": " + tail.trim() : " (exit " + code + ")")));
      });
    });
  }
}
