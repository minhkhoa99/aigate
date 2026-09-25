import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
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
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const app = await createServer({
  databaseFile: join(dataDir, "aigate.db"),
  secretKey: process.env.AIGATE_SECRET_KEY,
  streamIdleTimeoutMs: process.env.AIGATE_STREAM_IDLE_TIMEOUT_MS === undefined ? undefined : Number(process.env.AIGATE_STREAM_IDLE_TIMEOUT_MS),
  webDist: resolve(import.meta.dirname, "../../web/dist"),
});
await app.listen(port, host);
