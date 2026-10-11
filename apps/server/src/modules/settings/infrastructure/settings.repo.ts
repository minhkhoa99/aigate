import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { settings, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { SECRET_CIPHER, type SecretCipherPort } from "../../../secret-cipher.js";
import type { Settings, SettingsPatch } from "../domain/settings.js";

const ROW_ID = 1;
const columns = {
  requireLogin: settings.requireLogin, requireApiKey: settings.requireApiKey, fallbackStrategy: settings.fallbackStrategy, comboStickyLimit: settings.comboStickyLimit,
  tokenSaverEnabled: settings.tokenSaverEnabled, rtkEnabled: settings.rtkEnabled, headroomEnabled: settings.headroomEnabled,
  headroomUrl: settings.headroomUrl, headroomCompressUserMessages: settings.headroomCompressUserMessages, headroomTimeoutMs: settings.headroomTimeoutMs,
  cavemanEnabled: settings.cavemanEnabled, cavemanLevel: settings.cavemanLevel, ponytailEnabled: settings.ponytailEnabled,
  ponytailLevel: settings.ponytailLevel, pxpipeEnabled: settings.pxpipeEnabled, pxpipeMinChars: settings.pxpipeMinChars,
  pxpipeTimeoutMs: settings.pxpipeTimeoutMs,
  authMode: settings.authMode, oidcIssuerUrl: settings.oidcIssuerUrl, oidcClientId: settings.oidcClientId,
  oidcClientSecretSealed: settings.oidcClientSecretSealed, oidcScopes: settings.oidcScopes, oidcLoginLabel: settings.oidcLoginLabel,
  samlEntryPoint: settings.samlEntryPoint, samlIssuer: settings.samlIssuer, samlCertSealed: settings.samlCertSealed,
  samlAttributeEmail: settings.samlAttributeEmail, samlAttributeName: settings.samlAttributeName, ssoPublicOrigin: settings.ssoPublicOrigin,
};

export class SettingsChangedError extends Error {}
export const settingsVersion = (value: Settings): string => createHash("sha256")
  .update(JSON.stringify(Object.entries(value))).digest("hex");
type StoredSettings = Omit<Settings, "oidcConfigured" | "samlConfigured"> & { oidcClientSecretSealed: string | null; samlCertSealed: string | null };

// Read on the request hot path, so the row is cached and replaced on every write.
// ponytail: assumes this process is the only writer; other tools must change settings through the API.
@Injectable()
export class SettingsRepository {
  private current: Promise<Settings> | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle, @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort) {}

  get(): Promise<Settings> {
    this.current ??= this.load().catch((error: unknown) => {
      this.current = undefined;
      throw error;
    });
    return this.current;
  }

  async update(patch: SettingsPatch, expectedVersion?: string): Promise<Settings> {
    const current = await this.get();
    if (expectedVersion !== undefined && settingsVersion(current) !== expectedVersion) throw new SettingsChangedError("Settings changed since preview. Preview the document again.");
    if (Object.keys(patch).length === 0) return this.get();
    const { oidcClientSecret, samlCert, ...plain } = patch;
    const secretPatch = {
      ...(oidcClientSecret ? { oidcClientSecretSealed: this.cipher.seal(oidcClientSecret, "settings:oidc-client-secret") } : {}),
      ...(samlCert ? { samlCertSealed: this.cipher.seal(samlCert, "settings:saml-cert") } : {}),
    };
    const unchanged = expectedVersion === undefined ? [] : Object.entries(columns).filter(([key]) => !key.endsWith("Sealed")).map(([key, column]) => eq(column, Reflect.get(current, key)));
    const [row] = await this.database.db.update(settings).set({ ...plain, ...secretPatch }).where(and(eq(settings.id, ROW_ID), ...unchanged)).returning(columns);
    if (!row) {
      this.current = undefined;
      if (expectedVersion !== undefined) throw new SettingsChangedError("Settings changed since preview. Preview the document again.");
      throw new Error("settings row disappeared during update");
    }
     this.current = Promise.resolve(this.public(row));
     return this.public(row);
  }

  private async load(): Promise<Settings> {
    const { db } = this.database;
    await db.insert(settings).values({ id: ROW_ID }).onConflictDoNothing();
    const row = await db.select(columns).from(settings).where(eq(settings.id, ROW_ID)).get();
    if (!row) throw new Error("settings row missing after insert");
    return this.public(row);
  }

  async oidcSecret(): Promise<string | undefined> {
    const row = await this.database.db.select({ value: settings.oidcClientSecretSealed }).from(settings).where(eq(settings.id, ROW_ID)).get();
    return row?.value ? this.cipher.open(row.value, "settings:oidc-client-secret") : undefined;
  }

  async samlCertificate(): Promise<string | undefined> {
    const row = await this.database.db.select({ value: settings.samlCertSealed }).from(settings).where(eq(settings.id, ROW_ID)).get();
    return row?.value ? this.cipher.open(row.value, "settings:saml-cert") : undefined;
  }

  private public(row: StoredSettings): Settings {
    const oidcConfigured = Boolean(row.oidcIssuerUrl && row.oidcClientId && row.oidcClientSecretSealed);
    const samlConfigured = Boolean(row.samlEntryPoint && row.samlCertSealed);
    const safe: Omit<Settings, "oidcConfigured" | "samlConfigured"> = {
      requireLogin: row.requireLogin, requireApiKey: row.requireApiKey, fallbackStrategy: row.fallbackStrategy, comboStickyLimit: row.comboStickyLimit,
      tokenSaverEnabled: row.tokenSaverEnabled, rtkEnabled: row.rtkEnabled, headroomEnabled: row.headroomEnabled, headroomUrl: row.headroomUrl,
      headroomCompressUserMessages: row.headroomCompressUserMessages, headroomTimeoutMs: row.headroomTimeoutMs, cavemanEnabled: row.cavemanEnabled,
      cavemanLevel: row.cavemanLevel, ponytailEnabled: row.ponytailEnabled, ponytailLevel: row.ponytailLevel, pxpipeEnabled: row.pxpipeEnabled,
      pxpipeMinChars: row.pxpipeMinChars, pxpipeTimeoutMs: row.pxpipeTimeoutMs, authMode: row.authMode, oidcIssuerUrl: row.oidcIssuerUrl,
      oidcClientId: row.oidcClientId, oidcScopes: row.oidcScopes, oidcLoginLabel: row.oidcLoginLabel, samlEntryPoint: row.samlEntryPoint,
      samlIssuer: row.samlIssuer, samlAttributeEmail: row.samlAttributeEmail, samlAttributeName: row.samlAttributeName, ssoPublicOrigin: row.ssoPublicOrigin,
    };
    return { ...safe, oidcConfigured, samlConfigured };
  }
}
