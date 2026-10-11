import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { HttpTransportPort } from "@aigate/engine";
import { APP_VERSION } from "./app-version.js";

export interface UpdateConfig { manifestUrl?: string; publicKeyFile?: string }
export type ChannelState = "unconfigured" | "ready" | "invalid";
type Channel = { state: "ready"; url: string; key: KeyObject } | { state: "unconfigured" | "invalid" };
export interface UpdateCheck { at: number; latestVersion: string; hasUpdate: boolean; artifactBytes: number }
const MAX_MANIFEST = 4096;
const MAX_ARTIFACT = 512 * 1024 * 1024;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const coded = (code: string, message: string) => Object.assign(new Error(message), { code });

export function compareVersion(left: string, right: string): number {
  if (left.length > 128 || right.length > 128) throw coded("UPDATE_MANIFEST_INVALID", "A release version is invalid.");
  const a = VERSION.exec(left), b = VERSION.exec(right);
  if (!a || !b) throw coded("UPDATE_MANIFEST_INVALID", "A release version is invalid.");
  for (const match of [a, b]) if (match[4]?.split(".").some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) {
    throw coded("UPDATE_MANIFEST_INVALID", "A release version is invalid.");
  }
  for (let i = 1; i <= 3; i++) {
    const delta = BigInt(a[i]) - BigInt(b[i]);
    if (delta !== 0n) return delta > 0n ? 1 : -1;
  }
  if (!a[4] && !b[4]) return 0;
  if (!a[4]) return 1;
  if (!b[4]) return -1;
  const leftParts = a[4].split("."), rightParts = b[4].split(".");
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    if (leftParts[i] === undefined) return -1;
    if (rightParts[i] === undefined) return 1;
    const x = leftParts[i], y = rightParts[i];
    if (x === y) continue;
    const xn = /^(0|[1-9]\d*)$/.test(x), yn = /^(0|[1-9]\d*)$/.test(y);
    if (xn && yn) return BigInt(x) > BigInt(y) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

function parseManifest(value: unknown, key: KeyObject): { version: string; bytes: number } {
  if (!object(value) || Object.keys(value).sort().join(",") !== "artifact,bytes,format,sha256,signature,version" ||
    value.format !== "aigate-release" || typeof value.version !== "string" || value.version.length > 128 || !VERSION.test(value.version) ||
    value.artifact !== `aigate-${value.version}.tar.gz` || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_ARTIFACT ||
    typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256) ||
    typeof value.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(value.signature)) throw coded("UPDATE_MANIFEST_INVALID", "The release manifest is invalid.");
  const unsigned = { format: "aigate-release", version: value.version, artifact: value.artifact, bytes: value.bytes, sha256: value.sha256 };
  if (!verify(null, Buffer.from(JSON.stringify(unsigned)), key, Buffer.from(value.signature, "base64url"))) throw coded("UPDATE_MANIFEST_INVALID", "The release signature is invalid.");
  return { version: value.version, bytes: value.bytes };
}

async function boundedBody(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string> {
  if (!body) throw coded("UPDATE_MANIFEST_INVALID", "The release manifest is empty.");
  const reader = body.getReader();
  let received = 0, result = "", finished = false;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const onAbort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) {
        finished = true;
        try { return result + decoder.decode(); }
        catch { throw coded("UPDATE_MANIFEST_INVALID", "The release manifest is not UTF-8."); }
      }
      received += value.byteLength;
      if (received > MAX_MANIFEST) throw coded("UPDATE_MANIFEST_INVALID", "The release manifest exceeds 4 KiB.");
      try { result += decoder.decode(value, { stream: true }); }
      catch { throw coded("UPDATE_MANIFEST_INVALID", "The release manifest is not UTF-8."); }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export class SignedUpdate {
  private checking = false;
  private lastCheck: UpdateCheck | null = null;
  constructor(private readonly config: UpdateConfig, private readonly transport: HttpTransportPort) {}

  private async channel(): Promise<Channel> {
    if (!this.config.manifestUrl && !this.config.publicKeyFile) return { state: "unconfigured" };
    if (!this.config.manifestUrl || !this.config.publicKeyFile || !isAbsolute(this.config.publicKeyFile)) return { state: "invalid" };
    try {
      const url = new URL(this.config.manifestUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith(".manifest.json")) return { state: "invalid" };
      const info = await lstat(this.config.publicKeyFile);
      if (!info.isFile() || info.size > MAX_MANIFEST) return { state: "invalid" };
      const file = await open(this.config.publicKeyFile, "r");
      let key: KeyObject;
      try {
        const opened = await file.stat();
        if (!opened.isFile() || opened.size > MAX_MANIFEST) return { state: "invalid" };
        const buffer = Buffer.alloc(MAX_MANIFEST + 1);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        if (bytesRead > MAX_MANIFEST) return { state: "invalid" };
        key = createPublicKey(buffer.subarray(0, bytesRead));
      } finally { await file.close(); }
      return key.asymmetricKeyType === "ed25519" ? { state: "ready", url: url.href, key } : { state: "invalid" };
    } catch { return { state: "invalid" }; }
  }

  async status() {
    return { currentVersion: APP_VERSION, channel: (await this.channel()).state, checking: this.checking, lastCheck: this.lastCheck };
  }

  async check(signal: AbortSignal) {
    const channel = await this.channel();
    if (channel.state !== "ready") throw coded(channel.state === "unconfigured" ? "UPDATE_CHANNEL_UNCONFIGURED" : "UPDATE_CHANNEL_INVALID", "The signed release channel is not configured correctly.");
    if (this.checking) throw coded("UPDATE_BUSY", "An update check is already running.");
    this.checking = true;
    try {
      const response = await this.transport.send({ method: "GET", url: channel.url, headers: { accept: "application/json" }, timeoutMs: 4000 }, { signal, requestId: "release-check" });
      if (response.status !== 200) { await response.body?.cancel().catch(() => undefined); throw coded("UPDATE_CHECK_FAILED", "The release channel did not return a manifest."); }
      const content = await boundedBody(response.body, signal);
      let value: unknown;
      try { value = JSON.parse(content); }
      catch { throw coded("UPDATE_MANIFEST_INVALID", "The release manifest is not valid JSON."); }
      const manifest = parseManifest(value, channel.key);
      this.lastCheck = { at: Date.now(), latestVersion: manifest.version, hasUpdate: compareVersion(manifest.version, APP_VERSION) > 0, artifactBytes: manifest.bytes };
      return { currentVersion: APP_VERSION, channel: "ready" as const, checking: false, lastCheck: this.lastCheck };
    } catch (error) {
      if (object(error) && typeof error.code === "string" && error.code.startsWith("UPDATE_")) throw error;
      throw coded("UPDATE_CHECK_FAILED", "The release channel could not be checked.");
    } finally { this.checking = false; }
  }
}
