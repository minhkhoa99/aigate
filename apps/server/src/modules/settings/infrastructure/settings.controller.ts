import { BadRequestException, Body, Controller, Get, Header, Patch } from "@nestjs/common";
import { parseSettingsPatch, type Settings } from "../domain/settings.js";
import { SettingsRepository } from "./settings.repo.js";

@Controller("api/settings")
export class SettingsController {
  constructor(private readonly settings: SettingsRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  get(): Promise<Settings> {
    return this.settings.get();
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  patch(@Body() body: unknown): Promise<Settings> {
    const result = parseSettingsPatch(body);
    if (!result.ok) throw new BadRequestException({ code: "INVALID_REQUEST", message: result.message, keys: result.keys });
    return this.settings.update(result.patch);
  }
}
