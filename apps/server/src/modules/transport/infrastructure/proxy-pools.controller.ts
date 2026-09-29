import { randomUUID } from "node:crypto";
import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, Delete, GatewayTimeoutException, Get, Header, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { builtinRegistry, EngineError, readBoundedText, type HttpTransportPort } from "@aigate/engine";
import { PROXY_ROTATION_STRATEGIES } from "@aigate/database";
import { HTTP_TRANSPORT } from "../transport.token.js";
import { parseNewProxyPool, parseProxyPoolChanges, parseProxyPoolId } from "../domain/proxy-pool.js";
import { ProxyPoolsRepository } from "./proxy-pools.repo.js";
import { RelayDeployError, RelayDeployService } from "./relay-deploy.service.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const missing = () => new NotFoundException({ code: "NOT_FOUND", message: "No proxy pool with that id" });
const TEST_TIMEOUT_MS = 10_000;

@Controller("api/proxy-pools")
export class ProxyPoolsController {
  constructor(private readonly pools: ProxyPoolsRepository, private readonly deploys: RelayDeployService, @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort) {}

  @Post("vercel-deploy")
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async deployVercel(@Body() body: unknown) { return this.deploy(this.deploys.vercel.bind(this.deploys), body); }

  @Post("cloudflare-deploy")
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async deployCloudflare(@Body() body: unknown) { return this.deploy(this.deploys.cloudflare.bind(this.deploys), body); }

  @Post("deno-deploy")
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async deployDeno(@Body() body: unknown) { return this.deploy(this.deploys.deno.bind(this.deploys), body); }

  private async deploy(operation: (body: unknown) => Promise<unknown>, body: unknown) {
    try { return await operation(body); } catch (error) {
      if (error instanceof RelayDeployError) {
        const payload = { code: error.status === 400 ? "INVALID_REQUEST" : error.status === 409 ? "CONFLICT" : error.status === 504 ? "TIMEOUT" : "PROVIDER_UNAVAILABLE", message: error.message };
        if (error.status === 400) throw new BadRequestException(payload);
        if (error.status === 409) throw new ConflictException(payload);
        if (error.status === 504) throw new GatewayTimeoutException(payload);
        throw new BadGatewayException(payload);
      }
      throw error;
    }
  }

  @Get("rotations")
  @Header("Cache-Control", "no-store")
  async rotations() {
    const configured = new Map((await this.pools.rotations()).map((value) => [value.providerId, value]));
    return { rotations: builtinRegistry.providers.filter((provider) => provider.auth.kind === "none").map((provider) => {
      const value = configured.get(provider.id);
      return { providerId: provider.id, name: provider.name, rotateStrategy: value?.rotateStrategy ?? "none", proxyPoolId: value?.proxyPoolId ?? null };
    }) };
  }

  @Patch("rotations/:providerId")
  @Header("Cache-Control", "no-store")
  async setRotation(@Param("providerId") providerId: string, @Body() body: unknown) {
    const provider = builtinRegistry.provider(providerId);
    if (!provider || provider.auth.kind !== "none") throw invalid("providerId must name a keyless provider");
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw invalid("Body must be a JSON object");
    const value = Object.fromEntries(Object.entries(body));
    if (Object.keys(value).some((key) => key !== "rotateStrategy" && key !== "proxyPoolId")) throw invalid("Only rotateStrategy and proxyPoolId may be changed");
    const rotateStrategy = PROXY_ROTATION_STRATEGIES.find((strategy) => strategy === value.rotateStrategy);
    if (!rotateStrategy) throw invalid(`rotateStrategy must be one of ${PROXY_ROTATION_STRATEGIES.join(", ")}`);
    const parsedId = parseProxyPoolId(value.proxyPoolId);
    if (!parsedId.ok) throw invalid(parsedId.message);
    if (parsedId.value) {
      const pool = await this.pools.get(parsedId.value);
      if (!pool?.isActive) throw invalid("proxyPoolId must name an active proxy pool");
    }
    return { rotation: await this.pools.setRotation(providerId, rotateStrategy, parsedId.value) };
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async list() {
    const [pools, usage] = await Promise.all([this.pools.list(), this.pools.usage()]);
    return { proxyPools: pools.map((pool) => ({ ...pool, boundConnectionCount: usage.get(pool.id) ?? 0 })) };
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async get(@Param("id") id: string) { const pool = await this.pools.get(id); if (!pool) throw missing(); return { proxyPool: pool }; }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async create(@Body() body: unknown) {
    const parsed = parseNewProxyPool(body); if (!parsed.ok) throw invalid(parsed.message);
    return { proxyPool: await this.pools.create(parsed.value) };
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.pools.get(id); if (!current) throw missing();
    const updateBody = typeof body === "object" && body !== null && !Array.isArray(body) && !("type" in body) ? { ...body, type: current.type } : body;
    const parsed = parseProxyPoolChanges(updateBody);
    if (!parsed.ok) throw invalid(parsed.message);
    const value = await this.pools.update(id, parsed.value); if (!value) throw missing();
    return { proxyPool: value };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    const result = await this.pools.remove(id);
    if (result === "missing") throw missing();
    if (result === "bound") throw new ConflictException({ code: "PROXY_POOL_IN_USE", message: "Proxy pool is still assigned to one or more connections." });
  }

  @Post(":id/test")
  @Header("Cache-Control", "no-store")
  async test(@Param("id") id: string) {
    const pool = await this.pools.get(id); if (!pool) throw missing();
    const proxy = await this.pools.resolve(id); if (!proxy) throw invalid("Enable this proxy pool before testing it");
    const started = Date.now();
    try {
      const url = pool.type === "http" ? "https://www.google.com/" : "https://httpbin.org/get";
      const response = await this.transport.send({ method: pool.type === "http" ? "HEAD" : "GET", url, headers: {}, timeoutMs: TEST_TIMEOUT_MS }, { signal: AbortSignal.timeout(TEST_TIMEOUT_MS), requestId: randomUUID(), proxy });
      await readBoundedText(response.body, 64 * 1024);
      const proxyPool = await this.pools.recordTest(id, response.status >= 200 && response.status < 400, response.status >= 400 ? `Probe answered ${response.status}` : null);
      return { ok: response.status >= 200 && response.status < 400, status: response.status, elapsedMs: Date.now() - started, testedAt: proxyPool?.lastTestedAt, proxyPool };
    } catch (error) {
      const message = error instanceof EngineError ? error.message : "Could not reach proxy pool";
      const proxyPool = await this.pools.recordTest(id, false, message);
      return { ok: false, status: 0, error: message, elapsedMs: Date.now() - started, testedAt: proxyPool?.lastTestedAt, proxyPool };
    }
  }
}
