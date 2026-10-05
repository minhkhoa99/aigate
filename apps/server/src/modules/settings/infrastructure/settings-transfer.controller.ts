import { BadRequestException, Body, ConflictException, Controller, Get, Header, HttpCode, Post } from "@nestjs/common";
import { parseSettingsDocument, settingsDocument, type SettingsPatch } from "../domain/settings.js";
import { SettingsChangedError, SettingsRepository, settingsVersion } from "./settings.repo.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
function documentPatch(document: unknown): SettingsPatch {
  const result = parseSettingsDocument(document);
  if (!result.ok) throw new BadRequestException({ code: "INVALID_REQUEST", message: result.keys.length ? `${result.message}: ${result.keys.join(", ")}.` : result.message, keys: result.keys });
  return result.patch;
}

@Controller("api/settings")
export class SettingsTransferController {
  constructor(private readonly settings: SettingsRepository) {}

  @Get("export")
  @Header("Cache-Control", "no-store")
  @Header("Content-Disposition", 'attachment; filename="aigate-settings.json"')
  async export() { return settingsDocument(await this.settings.get()); }

  @Post("import/preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async preview(@Body() body: unknown) {
    const patch = documentPatch(body);
    const current = await this.settings.get();
    const changes = Object.entries(patch).filter(([key, value]) => Reflect.get(current, key) !== value)
      .map(([key, after]) => ({ key, before: Reflect.get(current, key), after }));
    return { version: settingsVersion(current), changes, settings: patch };
  }

  @Post("import")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async import(@Body() body: unknown) {
    if (typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length !== 2 || !Object.hasOwn(body, "document")) {
      throw invalid("Import needs only document and expectedVersion from its preview.");
    }
    const version: unknown = Reflect.get(body, "expectedVersion");
    if (typeof version !== "string" || !/^[a-f0-9]{64}$/.test(version)) throw invalid("expectedVersion must be the version returned by preview.");
    const patch = documentPatch(Reflect.get(body, "document"));
    try { return await this.settings.update(patch, version); }
    catch (error) {
      if (error instanceof SettingsChangedError) throw new ConflictException({ code: "SETTINGS_CHANGED", message: error.message });
      throw error;
    }
  }
}
