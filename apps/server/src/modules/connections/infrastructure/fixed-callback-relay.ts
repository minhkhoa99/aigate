import { createServer, type Server } from "node:http";

// provider.codex-oauth: 9router listens on 127.0.0.1:1455 for codex's fixed callback (a paste is the fallback). AIGate
// listens only while a sign-in waits, and sends the browser on to the dashboard's /callback with the same query, so the
// code reaches the dashboard window that holds the PKCE verifier and the usual exchange runs. One sign-in at a time:
// a new authorize replaces the waiting one.
const WAIT_MS = 600_000;

interface Waiting { readonly state: string; readonly path: string; readonly dashboardCallback: string }

export class FixedCallbackRelay {
  private server: Server | null = null;
  private port: number | null = null;
  private waiting: Waiting | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  // true when the listener is up; false when the address cannot be served (another program holds the port, or the
  // redirect is not plain http on 127.0.0.1/localhost), which leaves the paste.
  async wait(fixedRedirect: string, state: string, dashboardCallback: string): Promise<boolean> {
    const target = parseUrl(fixedRedirect);
    const back = parseUrl(dashboardCallback);
    if (!target || target.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(target.hostname) || !target.port) return false;
    if (!back || (back.protocol !== "http:" && back.protocol !== "https:")) return false;
    const port = Number(target.port);
    if (this.server && this.port !== port) this.stop();
    if (!this.server && !(await this.listen(port))) return false;
    this.waiting = { state, path: target.pathname, dashboardCallback: back.toString() };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), WAIT_MS);
    this.timer.unref();
    return true;
  }

  stop() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.server?.close();
    this.server = null;
    this.port = null;
    this.waiting = null;
  }

  private listen(port: number): Promise<boolean> {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const waiting = this.waiting;
      if (request.method !== "GET" || !waiting || url.pathname !== waiting.path) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("No AIGate sign-in is waiting here."); return;
      }
      if (url.searchParams.get("state") !== waiting.state) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("This sign-in is not the one AIGate is waiting for. Start the sign-in again, or paste this page's address in AIGate.");
        return;
      }
      const next = new URL(waiting.dashboardCallback);
      next.search = url.search;
      response.writeHead(302, { location: next.toString(), "cache-control": "no-store", connection: "close" });
      response.end();
      this.stop();
    });
    return new Promise((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => { this.server = server; this.port = port; resolve(true); });
    });
  }
}

function parseUrl(value: string): URL | null {
  try { return new URL(value); } catch { return null; }
}
