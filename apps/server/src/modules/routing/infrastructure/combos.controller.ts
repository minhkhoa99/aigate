import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { parseComboChanges, parseNewCombo, selfReference } from "../domain/combo.js";
import { CombosRepository, MAX_COMBOS } from "./combos.repo.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const missing = () => new NotFoundException({ code: "NOT_FOUND", message: "No combo with that id" });
const taken = () => new ConflictException({ code: "COMBO_EXISTS", message: "A combo with that name already exists" });

// docs/contracts/combos.md (combo.api-crud). Every route needs a dashboard session.
@Controller("api/combos")
export class CombosController {
  constructor(private readonly combos: CombosRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list() {
    return { combos: await this.combos.list() };
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async get(@Param("id") id: string) {
    const combo = await this.combos.get(id);
    if (!combo) throw missing();
    return { combo };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async create(@Body() body: unknown) {
    const parsed = parseNewCombo(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const self = selfReference(parsed.value);
    if (self) throw invalid(self);
    const combo = await this.combos.create(parsed.value);
    if (combo === "exists") throw taken();
    if (combo === "limit") throw new ConflictException({ code: "COMBO_LIMIT", message: `At most ${MAX_COMBOS} combos can be saved` });
    return { combo };
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = parseComboChanges(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const current = await this.combos.get(id);
    if (!current) throw missing();
    const self = selfReference({ name: parsed.value.name ?? current.name, models: parsed.value.models ?? current.models });
    if (self) throw invalid(self);
    const combo = await this.combos.update(id, parsed.value);
    if (combo === "missing") throw missing();
    if (combo === "exists") throw taken();
    return { combo };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.combos.remove(id))) throw missing();
  }
}
