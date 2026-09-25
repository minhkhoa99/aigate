import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import { MAX_KEYS, parseKeyName, parseKeyStatus } from "../domain/api-key.js";
import { ApiKeysRepository, type ApiKeyView } from "./api-keys.repo.js";

const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No API key with that id" });

// docs/contracts/identity-apikeys.md, "API keys". Protected by the global dashboard guard.
@Controller("api/keys")
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<ApiKeyView[]> {
    return this.keys.list();
  }

  // The plaintext key appears in this response only.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async create(@Body() body: unknown): Promise<ApiKeyView & { key: string }> {
    const parsed = parseKeyName(body);
    if (!parsed.ok) throw new BadRequestException({ code: "INVALID_REQUEST", message: parsed.message });
    const created = await this.keys.create(parsed.value);
    if (!created) throw new ConflictException({ code: "LIMIT_REACHED", message: `At most ${MAX_KEYS} API keys can exist` });
    return { ...created.view, key: created.key };
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<ApiKeyView> {
    const parsed = parseKeyStatus(body);
    if (!parsed.ok) throw new BadRequestException({ code: "INVALID_REQUEST", message: parsed.message });
    const view = await this.keys.setActive(id, parsed.value);
    if (!view) throw notFound();
    return view;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.keys.remove(id))) throw notFound();
  }
}
