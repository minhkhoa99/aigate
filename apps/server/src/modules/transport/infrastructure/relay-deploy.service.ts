import { Injectable, Inject } from "@nestjs/common";
import { EngineError, readBoundedText, type HttpTransportPort } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../transport.token.js";
import { ProxyPoolsRepository, type ProxyPoolView } from "./proxy-pools.repo.js";

const VERCEL = "https://api.vercel.com";
const CLOUDFLARE = "https://api.cloudflare.com/client/v4";
const DENO = "https://api.deno.com/v2";
const API_TIMEOUT_MS = 20_000;
const POLL_DELAY_MS = 3_000;
const POLL_MAX = 40;
const DENO_POLL_DELAY_MS = 2_000;
const DENO_POLL_MAX = 30;
const RELAY = `export const config={runtime:"edge"};export default async function(request){const target=request.headers.get("x-relay-target"),path=request.headers.get("x-relay-path")||"/";if(!target)return new Response(JSON.stringify({error:"Missing x-relay-target header"}),{status:400,headers:{"content-type":"application/json"}});const headers=new Headers(request.headers);headers.delete("x-relay-target");headers.delete("x-relay-path");headers.delete("host");const response=await fetch(target.replace(/\\/$/,"")+path,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:request.body,duplex:"half"});return new Response(response.body,{status:response.status,headers:response.headers})}`;

export class RelayDeployError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function project(value: unknown): string {
  const name = typeof value === "string" && value.trim() ? value.trim().toLowerCase() : `relay-${Date.now().toString(36)}`;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) throw new RelayDeployError(400, "projectName must be 1-63 lowercase letters, digits, or dashes");
  return name;
}
function token(value: unknown): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < 8 || result.length > 4096 || /\s/.test(result)) throw new RelayDeployError(400, "vercelToken must be 8-4096 non-space characters");
  return result;
}
function required(value: unknown, field: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < 8 || result.length > 4096 || /\s/.test(result)) throw new RelayDeployError(400, `${field} must be 8-4096 non-space characters`);
  return result;
}
function cloudflareId(value: unknown): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!/^[a-f0-9]{32}$/i.test(result)) throw new RelayDeployError(400, "accountId must be a 32-character Cloudflare account id");
  return result;
}
const pause = (ms = POLL_DELAY_MS) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const workerCode = `export default{async fetch(request){const target=request.headers.get("x-relay-target"),path=request.headers.get("x-relay-path")||"/";if(!target)return new Response(JSON.stringify({error:"Missing x-relay-target header"}),{status:400,headers:{"content-type":"application/json"}});const headers=new Headers(request.headers);headers.delete("x-relay-target");headers.delete("x-relay-path");headers.delete("host");try{const response=await fetch(target.replace(/\\/$/,"")+path,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:request.body,duplex:"half"});return new Response(response.body,{status:response.status,headers:response.headers})}catch(error){return new Response(JSON.stringify({error:String(error)}),{status:502,headers:{"content-type":"application/json"}})}}}`;
const denoCode = `Deno.serve(async(request)=>{const target=request.headers.get("x-relay-target"),path=request.headers.get("x-relay-path")||"/";if(!target)return new Response(JSON.stringify({error:"Missing x-relay-target header"}),{status:400,headers:{"content-type":"application/json"}});const headers=new Headers(request.headers);headers.delete("x-relay-target");headers.delete("x-relay-path");headers.delete("host");try{const response=await fetch(target.replace(/\\/$/,"")+path,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:request.body,duplex:"half"});return new Response(response.body,{status:response.status,headers:response.headers})}catch(error){return new Response(JSON.stringify({error:String(error)}),{status:502,headers:{"content-type":"application/json"}})}});`;

@Injectable()
export class RelayDeployService {
  constructor(@Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort, private readonly pools: ProxyPoolsRepository) {}

  async vercel(body: unknown): Promise<{ proxyPool: ProxyPoolView; deployUrl: string }> {
    const values = record(body);
    if (!values) throw new RelayDeployError(400, "Body must be a JSON object");
    const name = project(values.projectName);
    const accessToken = token(values.vercelToken);
    let deploymentId: string | undefined;
    try {
      const created = await this.json("POST", `${VERCEL}/v13/deployments`, accessToken, {
        name, target: "production", projectSettings: { framework: null },
        files: [{ file: "api/relay.js", data: RELAY }, { file: "package.json", data: JSON.stringify({ name, version: "1.0.0" }) }, { file: "vercel.json", data: JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/api/relay" }] }) }],
      });
      deploymentId = string(created.id) ?? string(created.uid);
      const projectId = string(created.projectId) ?? name;
      if (!deploymentId) throw new RelayDeployError(502, "Vercel did not return a deployment id");
      await this.json("PATCH", `${VERCEL}/v9/projects/${encodeURIComponent(projectId)}`, accessToken, { ssoProtection: null });
      const ready = await this.ready(deploymentId, accessToken);
      const url = string(ready.url);
      if (!url) throw new RelayDeployError(502, "Vercel did not return a relay URL");
      const deployUrl = `https://${url}`;
      return { proxyPool: await this.pools.create({ name, proxyUrl: deployUrl, type: "vercel", noProxy: "", isActive: true, strictProxy: false }), deployUrl };
    } catch (error) {
      if (deploymentId) await this.remove(deploymentId, accessToken);
      if (error instanceof RelayDeployError || error instanceof EngineError) throw error;
      throw new RelayDeployError(502, "Vercel relay deployment failed");
    }
  }

  async cloudflare(body: unknown): Promise<{ proxyPool: ProxyPoolView; deployUrl: string }> {
    const values = record(body);
    if (!values) throw new RelayDeployError(400, "Body must be a JSON object");
    const name = project(values.projectName);
    const accountId = cloudflareId(values.accountId);
    const accessToken = required(values.apiToken, "apiToken");
    const base = `${CLOUDFLARE}/accounts/${accountId}/workers/scripts/${encodeURIComponent(name)}`;
    let uploaded = false;
    try {
      const boundary = `aigate-${crypto.randomUUID()}`;
      const bytes = multipart(boundary, workerCode);
      await this.send("PUT", base, { authorization: `Bearer ${accessToken}`, "content-type": `multipart/form-data; boundary=${boundary}` }, bytes);
      uploaded = true;
      const subdomain = await this.send("POST", `${base}/subdomain`, { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, JSON.stringify({ enabled: true }));
      if (subdomain.status < 200 || subdomain.status >= 300) throw new RelayDeployError(502, `Cloudflare subdomain setup answered ${subdomain.status}`);
      const lookup = await this.jsonResponse(await this.send("GET", `${CLOUDFLARE}/accounts/${accountId}/workers/subdomain`, { authorization: `Bearer ${accessToken}` }));
      const result = record(lookup.result);
      const zone = string(result?.subdomain);
      if (!zone || !/^[a-z0-9-]+$/.test(zone)) throw new RelayDeployError(502, "Cloudflare did not return a valid workers.dev subdomain");
      const deployUrl = `https://${name}.${zone}.workers.dev`;
      return { proxyPool: await this.pools.create({ name, proxyUrl: deployUrl, type: "cloudflare", noProxy: "", isActive: true, strictProxy: false }), deployUrl };
    } catch (error) {
      if (uploaded) await this.removeCloudflare(base, accessToken);
      if (error instanceof RelayDeployError || error instanceof EngineError) throw error;
      throw new RelayDeployError(502, "Cloudflare relay deployment failed");
    }
  }

  async deno(body: unknown): Promise<{ proxyPool: ProxyPoolView; deployUrl: string }> {
    const values = record(body);
    if (!values) throw new RelayDeployError(400, "Body must be a JSON object");
    const name = project(values.projectName);
    const accessToken = required(values.denoToken, "denoToken");
    const orgDomain = typeof values.orgDomain === "string" ? values.orgDomain.trim().toLowerCase() : "";
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:deno\.net|deno\.dev)$/.test(orgDomain)) throw new RelayDeployError(400, "orgDomain must be your Deno Deploy domain, such as team.deno.net");
    const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
    let appId: string | undefined;
    try {
      const created = await this.jsonResponse(await this.send("POST", `${DENO}/apps`, headers, JSON.stringify({ slug: name, labels: { "custom.kind": "aigate-relay" }, config: { install: "deno install", runtime: { type: "dynamic", entrypoint: "main.ts" } } })));
      appId = string(created.id);
      if (!appId) throw new RelayDeployError(502, "Deno did not return an app id");
      const deployed = await this.jsonResponse(await this.send("POST", `${DENO}/apps/${encodeURIComponent(appId)}/deploy`, headers, JSON.stringify({ assets: { "main.ts": { kind: "file", content: denoCode, encoding: "utf-8" } } })));
      const revisionId = string(deployed.id);
      if (!revisionId) throw new RelayDeployError(502, "Deno did not return a revision id");
      let state = string(deployed.status) ?? "queued";
      for (let attempt = 0; (state === "queued" || state === "building") && attempt < DENO_POLL_MAX; attempt += 1) {
        await pause(DENO_POLL_DELAY_MS);
        const revision = await this.jsonResponse(await this.send("GET", `${DENO}/revisions/${encodeURIComponent(revisionId)}`, { authorization: `Bearer ${accessToken}` }));
        state = string(revision.status) ?? "unknown";
      }
      if (state !== "succeeded") throw new RelayDeployError(state === "queued" || state === "building" ? 504 : 502, state === "queued" || state === "building" ? "Deno relay deployment timed out after 60 seconds" : `Deno deployment ended with status ${state}`);
      const org = orgDomain.split(".")[0];
      const deployUrl = `https://${name}.${org}.deno.net`;
      return { proxyPool: await this.pools.create({ name, proxyUrl: deployUrl, type: "deno", noProxy: "", isActive: true, strictProxy: false }), deployUrl };
    } catch (error) {
      if (appId) await this.removeDeno(appId, accessToken);
      if (error instanceof RelayDeployError || error instanceof EngineError) throw error;
      throw new RelayDeployError(502, "Deno relay deployment failed");
    }
  }

  private async ready(id: string, accessToken: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < POLL_MAX; attempt += 1) {
      const status = await this.json("GET", `${VERCEL}/v13/deployments/${encodeURIComponent(id)}`, accessToken);
      const state = string(status.readyState);
      if (state === "READY") return status;
      if (state === "ERROR" || state === "CANCELED") throw new RelayDeployError(502, `Vercel deployment ${state.toLowerCase()}`);
      await pause();
    }
    throw new RelayDeployError(504, "Vercel deployment timed out after 120 seconds");
  }

  private async remove(id: string, accessToken: string): Promise<void> {
    await this.transport.send({ method: "DELETE", url: `${VERCEL}/v13/deployments/${encodeURIComponent(id)}`, headers: { authorization: `Bearer ${accessToken}` }, timeoutMs: API_TIMEOUT_MS }, { signal: AbortSignal.timeout(API_TIMEOUT_MS), requestId: crypto.randomUUID() }).catch(() => undefined);
  }

  private async removeCloudflare(url: string, accessToken: string): Promise<void> {
    await this.transport.send({ method: "DELETE", url, headers: { authorization: `Bearer ${accessToken}` }, timeoutMs: API_TIMEOUT_MS }, { signal: AbortSignal.timeout(API_TIMEOUT_MS), requestId: crypto.randomUUID() }).catch(() => undefined);
  }

  private async removeDeno(id: string, accessToken: string): Promise<void> {
    await this.transport.send({ method: "DELETE", url: `${DENO}/apps/${encodeURIComponent(id)}`, headers: { authorization: `Bearer ${accessToken}` }, timeoutMs: API_TIMEOUT_MS }, { signal: AbortSignal.timeout(API_TIMEOUT_MS), requestId: crypto.randomUUID() }).catch(() => undefined);
  }

  private async send(method: "GET" | "POST" | "PUT" | "DELETE", url: string, headers: Readonly<Record<string, string>>, body?: string | Uint8Array) {
    return this.transport.send({ method, url, headers, ...(body === undefined ? {} : { body }), timeoutMs: API_TIMEOUT_MS }, { signal: AbortSignal.timeout(API_TIMEOUT_MS), requestId: crypto.randomUUID() });
  }

  private async jsonResponse(response: Awaited<ReturnType<RelayDeployService["send"]>>): Promise<Record<string, unknown>> {
    const text = await readBoundedText(response.body, 256 * 1024);
    if (response.status < 200 || response.status >= 300) throw new RelayDeployError(response.status === 409 ? 409 : 502, `Relay provider API answered ${response.status}`);
    try { return record(JSON.parse(text)) ?? {}; } catch { throw new RelayDeployError(502, "Relay provider returned invalid JSON"); }
  }

  private async json(method: "GET" | "POST" | "PATCH", url: string, accessToken: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.transport.send({ method, url, headers: { authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), timeoutMs: API_TIMEOUT_MS }, { signal: AbortSignal.timeout(API_TIMEOUT_MS), requestId: crypto.randomUUID() });
    const text = await readBoundedText(response.body, 256 * 1024);
    if (response.status < 200 || response.status >= 300) throw new RelayDeployError(response.status === 409 ? 409 : 502, `Vercel API answered ${response.status}`);
    try { return record(JSON.parse(text)) ?? {}; } catch { throw new RelayDeployError(502, "Vercel returned invalid JSON"); }
  }
}
function string(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined; }
function record(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined; }
function multipart(boundary: string, code: string): Uint8Array {
  const encoder = new TextEncoder();
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="index.js"; filename="index.js"\r\nContent-Type: application/javascript+module\r\n\r\n${code}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="metadata"; filename="metadata.json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ main_module: "index.js", compatibility_date: "2024-03-20", observability: { enabled: true } })}\r\n`,
    `--${boundary}--\r\n`,
  ].map((part) => encoder.encode(part));
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
