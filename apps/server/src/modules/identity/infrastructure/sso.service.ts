import { createHash, randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { Injectable, Inject } from "@nestjs/common";
import { createLocalJWKSet, jwtVerify } from "jose";
import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { readBoundedText, type HttpTransportPort } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";

const OIDC_MAX_BYTES = 64 * 1024;
const SSO_TIMEOUT_MS = 8_000;
const PENDING_TTL_MS = 10 * 60_000;
const MAX_PENDING = 100;
const DEFAULT_SCOPES = "openid profile email";

export interface OidcConfig { issuerUrl: string; clientId: string; clientSecret: string; scopes: string; loginLabel: string }
export interface SamlConfig { entryPoint: string; issuer: string; cert: string; attributeEmail: string; attributeName: string }
interface PendingSaml { saml: SAML; config: SamlConfig; origin: string; createdAt: number; version: string }
interface PendingOidc { config: OidcConfig; nonce: string; verifier: string; origin: string; createdAt: number; version: string }

const trimUrl = (value: string) => value.trim().replace(/\/+$/, "");
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const version = (value: OidcConfig | SamlConfig) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function ssoUrl(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.hash || !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error("SSO URLs must use HTTPS, or HTTP on loopback, without credentials or fragments");
  return url.toString();
}
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 256) : Array.isArray(value) && typeof value[0] === "string" ? value[0].slice(0, 256) : "";

@Injectable()
export class SsoService {
  private readonly pendingSaml = new Map<string, PendingSaml>();
  private readonly pendingOidc = new Map<string, PendingOidc>();

  constructor(private readonly settings: SettingsRepository, @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort) {}

  async oidcConfig(): Promise<OidcConfig | undefined> {
    const value = await this.settings.get();
    if (value.authMode !== "oidc" && value.authMode !== "both") return undefined;
    const secret = await this.settings.oidcSecret();
    if (!value.oidcIssuerUrl || !value.oidcClientId || !secret) return undefined;
    return { issuerUrl: trimUrl(value.oidcIssuerUrl), clientId: value.oidcClientId.trim(), clientSecret: secret, scopes: value.oidcScopes.trim() || DEFAULT_SCOPES, loginLabel: value.oidcLoginLabel.trim() || "Sign in with OIDC" };
  }

  async samlConfig(): Promise<SamlConfig | undefined> {
    const value = await this.settings.get();
    if (value.authMode !== "saml" && value.authMode !== "both") return undefined;
    const cert = await this.settings.samlCertificate();
    if (!value.samlEntryPoint || !cert) return undefined;
    return { entryPoint: value.samlEntryPoint, issuer: value.samlIssuer || "urn:aigate:sp", cert, attributeEmail: value.samlAttributeEmail, attributeName: value.samlAttributeName };
  }

  async discover(issuerUrl: string): Promise<Record<string, string>> {
    ssoUrl(issuerUrl);
    const response = await this.sendJson("GET", `${trimUrl(issuerUrl)}/.well-known/openid-configuration`);
    const data = response.body;
    if (!object(data) || typeof data.issuer !== "string" || trimUrl(data.issuer) !== trimUrl(issuerUrl) || typeof data.authorization_endpoint !== "string" || typeof data.token_endpoint !== "string" || typeof data.jwks_uri !== "string") throw new Error("OIDC discovery issuer or endpoints are invalid");
    ssoUrl(data.issuer);
    return { issuer: data.issuer, authorizationEndpoint: ssoUrl(data.authorization_endpoint), tokenEndpoint: ssoUrl(data.token_endpoint), jwksUri: ssoUrl(data.jwks_uri) };
  }

  async oidcStart(origin: string): Promise<{ url: string; cookies: { state: string; nonce: string; verifier: string } }> {
    const config = await this.oidcConfig();
    if (!config) throw new Error("OIDC is not configured");
    this.prunePending();
    if (this.pendingOidc.size >= MAX_PENDING) throw new Error("Too many pending sign-ins; try again after ten minutes");
    const discovery = await this.discover(config.issuerUrl);
    const state = randomBytes(16).toString("base64url");
    const nonce = randomBytes(16).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const url = new URL(discovery.authorizationEndpoint);
    for (const [key, value] of Object.entries({ response_type: "code", client_id: config.clientId, redirect_uri: `${origin}/api/auth/oidc/callback`, scope: config.scopes, state, nonce, code_challenge: challenge, code_challenge_method: "S256" })) url.searchParams.set(key, value);
    if (this.pendingOidc.size >= MAX_PENDING) throw new Error("Too many pending sign-ins");
    this.pendingOidc.set(state, { config, nonce, verifier, origin, createdAt: Date.now(), version: version(config) });
    return { url: url.toString(), cookies: { state, nonce, verifier } };
  }

  async oidcCallback(state: string, code: string): Promise<void> {
    this.prunePending();
    const pending = this.pendingOidc.get(state);
    this.pendingOidc.delete(state);
    const current = await this.oidcConfig();
    if (!pending || !current || pending.version !== version(current)) throw new Error("OIDC sign-in expired or configuration changed");
    const { config, verifier, nonce, origin } = pending;
    const discovery = await this.discover(config.issuerUrl);
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: `${origin}/api/auth/oidc/callback`, code_verifier: verifier });
    const token = await this.sendJson("POST", discovery.tokenEndpoint, body.toString(), "application/x-www-form-urlencoded");
    const payload = token.body;
    if (!object(payload) || typeof payload.id_token !== "string" || payload.id_token.length > 32768) throw new Error("OIDC token response did not include a bounded ID token");
    const jwksResponse = await this.sendJson("GET", discovery.jwksUri);
    const keys = jwksResponse.body;
    if (!object(keys) || !Array.isArray(keys.keys) || keys.keys.length > 20 || !keys.keys.every(object)) throw new Error("OIDC key set is invalid");
    const jwks = createLocalJWKSet({ keys: keys.keys });
    const verified = await jwtVerify(payload.id_token, jwks, { issuer: discovery.issuer, audience: config.clientId, algorithms: ["RS256", "ES256", "PS256"], requiredClaims: ["sub", "iat", "exp", "nonce"] });
    const claims = verified.payload;
    if (claims.nonce !== nonce || typeof claims.sub !== "string" || !claims.sub || (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== config.clientId) || (claims.azp !== undefined && claims.azp !== config.clientId)) throw new Error("OIDC nonce or authorized party did not match");
  }

  async testOidc(input: Partial<OidcConfig>, origin: string): Promise<Record<string, unknown>> {
    const saved = await this.settings.get();
    const current = { issuerUrl: saved.oidcIssuerUrl, clientId: saved.oidcClientId, clientSecret: await this.settings.oidcSecret() };
    const issuerUrl = trimUrl(input.issuerUrl ?? current?.issuerUrl ?? "");
    const clientId = (input.clientId ?? current?.clientId ?? "").trim();
    const secret = input.clientSecret ?? current?.clientSecret ?? "";
    if (!issuerUrl || !clientId) throw new Error("OIDC issuer URL and client ID are required");
    const discovery = await this.discover(issuerUrl);
    let clientSecretValid: boolean | null = null;
    if (secret) {
      const body = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: secret, code: "__aigate_invalid_code__", redirect_uri: `${origin}/api/auth/oidc/callback`, code_verifier: "__aigate_invalid_verifier__" });
      const response = await this.sendJson("POST", discovery.tokenEndpoint, body.toString(), "application/x-www-form-urlencoded", true);
      const code = object(response.body) && typeof response.body.error === "string" ? response.body.error : "";
      clientSecretValid = code === "invalid_grant" || code === "invalid_code" ? true : code === "invalid_client" || code === "unauthorized_client" ? false : null;
    }
    return { ok: clientSecretValid !== false, discoveryOk: true, clientSecretTested: Boolean(secret), clientSecretValid, authorizationEndpoint: discovery.authorizationEndpoint, tokenEndpoint: discovery.tokenEndpoint, jwksUri: discovery.jwksUri };
  }

  async samlStart(origin: string): Promise<{ requestId: string; url: string }> {
    const config = await this.samlConfig();
    if (!config) throw new Error("SAML is not configured");
    this.prunePending();
    if (this.pendingSaml.size >= MAX_PENDING) throw new Error("Too many pending sign-ins; try again after ten minutes");
    const requestId = `_${randomBytes(20).toString("hex")}`;
    const saml = this.samlInstance(config, origin, requestId);
    const url = await saml.getAuthorizeUrlAsync(requestId, undefined, {});
    if (this.pendingSaml.size >= MAX_PENDING) throw new Error("Too many pending sign-ins");
    this.pendingSaml.set(requestId, { saml, config, origin, createdAt: Date.now(), version: version(config) });
    return { requestId, url };
  }

  async samlCallback(requestId: string, response: string): Promise<{ subject: string; email: string; name: string }> {
    this.prunePending();
    const pending = this.pendingSaml.get(requestId);
    this.pendingSaml.delete(requestId);
    const current = await this.samlConfig();
    if (!pending || !current || pending.version !== version(current)) throw new Error("SAML sign-in expired or configuration changed");
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(response) || response.length > 256 * 1024) throw new Error("SAML response is invalid or too large");
    const xml = Buffer.from(response, "base64").toString("utf8");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("SAML response cannot contain document entities");
    const result = await pending.saml.validatePostResponseAsync({ SAMLResponse: response });
    if (!result.profile || result.loggedOut || !text(result.profile.nameID)) throw new Error("SAML did not return an authenticated identity");
    const profile = result.profile;
    return {
      subject: text(profile.nameID),
      email: text(profile[pending.config.attributeEmail]) || text(profile.email) || text(profile.mail) || text(profile["urn:oid:0.9.2342.19200300.100.1.3"]),
      name: text(profile[pending.config.attributeName]) || text(profile.displayName) || text(profile.cn) || text(profile.nameID),
    };
  }

  async samlTest(input: Partial<SamlConfig>): Promise<Record<string, unknown>> {
    const saved = await this.settings.get();
    const current = { entryPoint: saved.samlEntryPoint, issuer: saved.samlIssuer, cert: await this.settings.samlCertificate() };
    const entryPoint = input.entryPoint ?? current?.entryPoint ?? "";
    const issuer = input.issuer ?? current?.issuer ?? "";
    const cert = input.cert ?? current?.cert ?? "";
    ssoUrl(entryPoint);
    if (!issuer || !cert) throw new Error("SAML issuer and certificate are required");
    new X509Certificate(cert);
    return { ok: true, samlEntryPoint: entryPoint, samlIssuer: issuer, certValid: true };
  }

  private prunePending(): void {
    const cutoff = Date.now() - PENDING_TTL_MS;
    for (const [id, row] of this.pendingSaml) if (row.createdAt < cutoff) this.pendingSaml.delete(id);
    for (const [id, row] of this.pendingOidc) if (row.createdAt <= cutoff) this.pendingOidc.delete(id);
  }

  async samlMetadata(origin: string): Promise<string> {
    const config = await this.samlConfig();
    if (!config) throw new Error("SAML is not configured");
    return this.samlInstance(config, origin).generateServiceProviderMetadata(null);
  }

  private samlInstance(config: SamlConfig, origin: string, requestId?: string): SAML {
    ssoUrl(config.entryPoint);
    new X509Certificate(config.cert);
    let item: { value: string; createdAt: number } | null = null;
    return new SAML({ entryPoint: config.entryPoint, issuer: config.issuer, audience: config.issuer, idpCert: config.cert,
      callbackUrl: `${origin}/api/auth/saml/acs`, acceptedClockSkewMs: 60000, wantAssertionsSigned: true, wantAuthnResponseSigned: false,
      validateInResponseTo: ValidateInResponseTo.always, requestIdExpirationPeriodMs: PENDING_TTL_MS, maxAssertionAgeMs: PENDING_TTL_MS,
      ...(requestId ? { generateUniqueId: () => requestId } : {}),
      cacheProvider: { saveAsync: async (key, value) => { if (key !== requestId) return null; item = { value, createdAt: Date.now() }; return item; },
        getAsync: async key => key === requestId && item && Date.now() - item.createdAt < PENDING_TTL_MS ? item.value : null,
        removeAsync: async key => { if (key !== requestId) return null; const prior = item?.value ?? null; item = null; return prior; } } });
  }

  private async sendJson(method: "GET" | "POST", url: string, body?: string, contentType = "application/json", allowError = false): Promise<{ status: number; body: unknown }> {
    ssoUrl(url);
    const response = await this.transport.send({ method, url, headers: { accept: "application/json", ...(body ? { "content-type": contentType } : {}) }, ...(body ? { body } : {}), timeoutMs: SSO_TIMEOUT_MS }, { signal: AbortSignal.timeout(SSO_TIMEOUT_MS), requestId: randomUUID() });
    const raw = await readBoundedText(response.body, OIDC_MAX_BYTES);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("SSO endpoint returned invalid JSON"); }
    if (!allowError && (response.status < 200 || response.status >= 300)) throw new Error(`SSO endpoint answered HTTP ${response.status}`);
    return { status: response.status, body: parsed };
  }
}
