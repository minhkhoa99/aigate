import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Headers, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
  Res, UnauthorizedException,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { extractApiKey } from "../../apikeys/domain/api-key.js";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { Public } from "../../identity/infrastructure/public.decorator.js";
import { MAX_SKILLS, parseSkill, parseSkillPatch } from "../domain/skill.js";
import { SkillsRepository, type SkillDetail, type SkillSummary } from "./skills.repo.js";

const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No skill with that id." });
const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const exists = () => new ConflictException({ code: "SKILL_EXISTS", message: "A skill with this name already exists." });

// docs/contracts/skills.md. Protected by the global dashboard guard.
@Controller("api/tooling/skills")
export class SkillsController {
  constructor(private readonly skills: SkillsRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<SkillSummary[]> {
    return this.skills.list();
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async get(@Param("id") id: string): Promise<SkillDetail> {
    const skill = await this.skills.get(id);
    if (!skill) throw notFound();
    return skill;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<SkillDetail> {
    const parsed = parseSkill(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const created = await this.skills.create(parsed.value);
    if (created === "limit") throw new ConflictException({ code: "SKILL_LIMIT", message: `At most ${MAX_SKILLS} skills can be saved.` });
    if (created === "exists") throw exists();
    return created;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<SkillDetail> {
    const current = await this.skills.get(id);
    if (!current) throw notFound();
    const parsed = parseSkillPatch(body, current.source);
    if (!parsed.ok) throw invalid(parsed.message);
    const updated = await this.skills.update(id, parsed.value);
    if (updated === "missing") throw notFound();
    if (updated === "exists") throw exists();
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.skills.remove(id))) throw notFound();
  }
}

// The SKILL.md of an enabled file skill, for coding agents. Always needs an active AIGate API key, even when the
// /v1 lane runs keyless, because a tunnel may expose this route.
@Public()
@Controller("v1/skills")
export class SkillFileController {
  constructor(private readonly skills: SkillsRepository, private readonly keys: ApiKeysRepository) {}

  @Get(":id/SKILL.md")
  async file(@Param("id") id: string, @Headers() headers: Record<string, string | string[] | undefined>, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    reply.header("Cache-Control", "no-store");
    const key = extractApiKey(headers);
    if (!key) throw new UnauthorizedException({ code: "MISSING_API_KEY", message: "Send an AIGate API key as Authorization: Bearer <key> or x-api-key." });
    if (!(await this.keys.isValid(key))) throw new UnauthorizedException({ code: "INVALID_API_KEY", message: "The API key is not valid or was disabled. Check it in AIGate: Gateway → Endpoint & Keys." });
    const content = await this.skills.servable(id);
    if (content === undefined) throw notFound();
    reply.header("Content-Type", "text/markdown; charset=utf-8").header("X-Content-Type-Options", "nosniff");
    return content;
  }
}
