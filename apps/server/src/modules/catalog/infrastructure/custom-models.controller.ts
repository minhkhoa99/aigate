import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { CustomModelsRepository } from "./custom-models.repo.js";

// docs/contracts/custom-models.md. Protected by the global dashboard guard. As in 9router (kept by user decision),
// the provider and the ids are not checked beyond being non-empty strings.
const MAX_IDS = 1000;
const REQUIRED = "provider and ids required";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const filled = (value: unknown): value is string => typeof value === "string" && value !== "";

@Controller("api/models/custom")
export class CustomModelsController {
  constructor(private readonly models: CustomModelsRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Query("provider") provider: unknown) {
    return { models: await this.models.list(filled(provider) ? provider : undefined) };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async add(@Body() body: unknown) {
    const field = (name: string): unknown => (typeof body === "object" && body !== null ? Reflect.get(body, name) : undefined);
    const provider = field("provider");
    const ids = field("ids");
    if (!filled(provider) || !Array.isArray(ids) || ids.length === 0 || !ids.every(filled)) throw invalid(REQUIRED);
    if (ids.length > MAX_IDS) throw invalid(`At most ${MAX_IDS} ids per request`);
    return { success: true, added: await this.models.add(provider, ids) };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Query("provider") provider: unknown, @Query("id") id: unknown): Promise<void> {
    if (!filled(provider) || !filled(id)) throw invalid("provider and id required");
    await this.models.remove(provider, id);
  }
}
