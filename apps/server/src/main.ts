// First: loads .env into process.env before any other module reads it.
import "./env.js";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createServer } from "./server.js";

const DEFAULT_PORT = 20200;

function readPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`PORT must be an integer from 1 to 65535, got "${value}"`);
  }
  return port;
}

// Loopback by default: the gateway will hold provider credentials. Set HOST to expose it.
const host = process.env.HOST ?? "127.0.0.1";
const port = readPort(process.env.PORT);
// Owner-only: the database will hold provider credentials.
const dataDir = process.env.AIGATE_DATA_DIR ?? join(homedir(), ".aigate");
if (process.env.AIGATE_MANAGED_ROOT) {
  const inside = (parent: string, child: string) => {
    const path = relative(resolve(parent), resolve(child));
    return !path || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  };
  if (inside(process.env.AIGATE_MANAGED_ROOT, dataDir) || inside(dataDir, process.env.AIGATE_MANAGED_ROOT)) {
    throw new RangeError("AIGATE_DATA_DIR and the managed release root must be separate.");
  }
}
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const app = await createServer({
  databaseFile: join(dataDir, "aigate.db"),
  dataDir,
  secretKey: process.env.AIGATE_SECRET_KEY,
  streamIdleTimeoutMs: process.env.AIGATE_STREAM_IDLE_TIMEOUT_MS === undefined ? undefined : Number(process.env.AIGATE_STREAM_IDLE_TIMEOUT_MS),
  usageTimezone: process.env.AIGATE_USAGE_TIMEZONE || undefined,
  usageRetentionDays: process.env.AIGATE_USAGE_RETENTION_DAYS === undefined ? undefined : Number(process.env.AIGATE_USAGE_RETENTION_DAYS),
  webDist: resolve(import.meta.dirname, "../../web/dist"),
});
await app.listen(port, host);
if (process.send) process.send("aigate-ready");
