import { BadRequestException, Body, Controller, Get, Header, HttpCode, Post, Query, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { LoginLimiter } from "../domain/login-limiter.js";
import { IdentityRepository } from "./identity.repo.js";
import { Public } from "./public.decorator.js";
import { setSessionCookie } from "./session-cookie.js";
import { SsoService } from "./sso.service.js";

const OIDC_COOKIE = "aigate_oidc";
const SAML_COOKIE = "aigate_saml";
const cookieValue = (req: FastifyRequest, name: string) => req.headers.cookie?.split(";").map(x => x.trim().split("=")).find(x => x[0] === name)?.[1];
function transient(req: FastifyRequest, name: string, value: string, maxAge = 600, origin?: string): string {
  // A TLS reverse proxy terminates HTTPS before Fastify sees it. Use the configured public origin
  // for the cross-site SAML POST cookie, never an untrusted forwarded-protocol header.
  return `${name}=${value}; Path=/api/auth; HttpOnly; Max-Age=${maxAge}; ${origin?.startsWith("https:") || req.protocol === "https" ? "SameSite=None; Secure" : "SameSite=Lax"}`;
}
const field = (body: unknown, name: string, max = 2048) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const value: unknown = Reflect.get(body, name);
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw new BadRequestException({ code: "INVALID_REQUEST", message: `${name} must be a string of at most ${max} characters` });
  return value;
};

@Controller("api/auth")
export class SsoController {
  constructor(private readonly sso: SsoService, private readonly identity: IdentityRepository,
    private readonly settings: SettingsRepository, private readonly limiter: LoginLimiter) {}

  @Post("oidc/test") @HttpCode(200) @Header("Cache-Control", "no-store")
  async oidcTest(@Body() body: unknown, @Req() req: FastifyRequest) {
    const input = { issuerUrl: field(body, "issuerUrl"), clientId: field(body, "clientId", 256), clientSecret: field(body, "clientSecret", 65536), scopes: field(body, "scopes", 256) };
    try { return await this.sso.testOidc(input, await this.origin(req)); }
    catch { throw new ServiceUnavailableException({ code: "OIDC_TEST_FAILED", message: "OIDC discovery or client probe failed. Check the issuer URL, client and upstream availability." }); }
  }

  @Post("saml/test") @HttpCode(200) @Header("Cache-Control", "no-store")
  async samlTest(@Body() body: unknown, @Req() req: FastifyRequest) {
    const input = { entryPoint: field(body, "samlEntryPoint"), issuer: field(body, "samlIssuer", 256), cert: field(body, "samlCert", 65536) };
    try { return { ...await this.sso.samlTest(input), acsUrl: `${await this.origin(req)}/api/auth/saml/acs`, metadataUrl: `${await this.origin(req)}/api/auth/saml/metadata` }; }
    catch { throw new BadRequestException({ code: "SAML_CONFIG_INVALID", message: "SAML entry point, issuer or X.509 certificate is invalid. This test is local and does not contact the IdP." }); }
  }

  @Public() @Get("oidc/start")
  async oidcStart(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    if (!this.allowed(req)) return this.fail(reply, "RATE_LIMITED");
    try {
      const origin = await this.origin(req);
      const result = await this.sso.oidcStart(origin);
      reply.header("set-cookie", transient(req, OIDC_COOKIE, result.cookies.state, 600, origin));
      return reply.code(302).redirect(result.url);
    } catch { return this.fail(reply, "OIDC_START_FAILED"); }
  }

  @Public() @Get("oidc/callback")
  async oidcCallback(@Query() query: Record<string, unknown>, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    const state = cookieValue(req, OIDC_COOKIE);
    const clearing = transient(req, OIDC_COOKIE, "", 0);
    reply.header("set-cookie", clearing);
    if (!this.allowed(req)) return this.fail(reply, "RATE_LIMITED");
    if (!state || query.state !== state || typeof query.code !== "string" || !query.code || query.code.length > 8192 || query.error) {
      this.limiter.fail(req.ip); return this.fail(reply, "OIDC_LOGIN_FAILED");
    }
    try {
      await this.sso.oidcCallback(state, query.code);
      const token = await this.identity.createSession();
      setSessionCookie(req, reply, token, (await this.origin(req)).startsWith("https:"));
      const session = reply.getHeader("set-cookie");
      reply.header("set-cookie", [clearing, String(session)]);
      this.limiter.succeed(req.ip);
      return reply.code(302).redirect("/");
    } catch { this.limiter.fail(req.ip); return this.fail(reply, "OIDC_LOGIN_FAILED"); }
  }

  @Public() @Get("saml/start")
  async samlStart(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    if (!this.allowed(req)) return this.fail(reply, "RATE_LIMITED");
    try {
      const origin = await this.origin(req);
      const result = await this.sso.samlStart(origin);
      reply.header("set-cookie", transient(req, SAML_COOKIE, result.requestId, 600, origin));
      return reply.code(302).redirect(result.url);
    } catch { return this.fail(reply, "SAML_START_FAILED"); }
  }

  @Public() @Post("saml/acs")
  async samlAcs(@Body() body: unknown, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    const clearing = transient(req, SAML_COOKIE, "", 0);
    reply.header("set-cookie", clearing);
    if (!this.allowed(req)) return this.fail(reply, "RATE_LIMITED");
    const state = cookieValue(req, SAML_COOKIE);
    const raw = typeof body === "string" ? new URLSearchParams(body) : undefined;
    if (!state || !raw || raw.getAll("RelayState").length !== 1 || raw.get("RelayState") !== state || raw.getAll("SAMLResponse").length !== 1) {
      this.limiter.fail(req.ip); return this.fail(reply, "SAML_LOGIN_FAILED");
    }
    try {
      await this.sso.samlCallback(state, raw.get("SAMLResponse") ?? "");
      const token = await this.identity.createSession();
      setSessionCookie(req, reply, token, (await this.origin(req)).startsWith("https:"));
      const session = reply.getHeader("set-cookie");
      reply.header("set-cookie", [clearing, String(session)]);
      this.limiter.succeed(req.ip);
      return reply.code(302).redirect("/");
    } catch { this.limiter.fail(req.ip); return this.fail(reply, "SAML_LOGIN_FAILED"); }
  }

  @Public() @Get("saml/metadata") @Header("Cache-Control", "no-store")
  async metadata(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    try { return reply.type("application/samlmetadata+xml").send(await this.sso.samlMetadata(await this.origin(req))); }
    catch { return reply.code(400).type("application/json").send({ code: "SAML_CONFIG_INVALID", message: "Configure SAML before downloading metadata." }); }
  }

  private allowed(req: FastifyRequest): boolean { return !this.limiter.check(req.ip).locked; }
  private fail(reply: FastifyReply, code: string) { return reply.code(302).redirect(`/login?error=${code}`); }
  private async origin(req: FastifyRequest): Promise<string> {
    const saved = await this.settings.get();
    if (saved.ssoPublicOrigin) {
      const configured = new URL(saved.ssoPublicOrigin);
      if (configured.pathname !== "/" || configured.search || configured.hash || configured.username || configured.password) throw new Error("Configured SSO origin is invalid");
      return configured.origin;
    }
    const url = new URL(`${req.protocol}://${req.headers.host ?? ""}`);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) throw new Error("Configure a public SSO origin for non-loopback access");
    return url.origin;
  }
}

// The sole form-parser exception is ACS; every other management POST remains JSON-only.
export function registerSamlBoundary(fastify: FastifyInstance): void {
  fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 256 * 1024 }, (_req, body, done) => done(null, body));
  fastify.addHook("onRequest", (request, reply, done) => {
    if (request.headers["content-type"]?.split(";", 1)[0].trim() === "application/x-www-form-urlencoded" && request.url.split("?", 1)[0] !== "/api/auth/saml/acs") {
      reply.code(415).type("application/json").send({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Only the SAML ACS accepts form bodies" });
      return;
    }
    done();
  });
  fastify.addHook("onRoute", route => { if (route.url === "/api/auth/saml/acs") route.bodyLimit = 256 * 1024; });
}
