import {
  BadGatewayException, BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Headers, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
  Res, UnauthorizedException,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { extractApiKey } from "../../apikeys/domain/api-key.js";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { Public } from "../../identity/infrastructure/public.decorator.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { MAX_ALWAYS_SKILLS, MAX_SKILLS, parseSkill, parseSkillPatch, rawSkillUrl } from "../domain/skill.js";
import { SkillContext } from "./skill-context.js";
import { SkillsRepository, type SkillDetail, type SkillSummary } from "./skills.repo.js";

const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No skill with that id." });
const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const exists = () => new ConflictException({ code: "SKILL_EXISTS", message: "A skill with this name already exists." });
const alwaysLimit = () => new ConflictException({ code: "SKILL_ALWAYS_LIMIT", message: `At most ${MAX_ALWAYS_SKILLS} skills can be always on.` });
const MAX_PREVIEW_CHARS = 16_384;

type Named = { id: string; name: string };
// The top-level selection is what a target without tool calls gets; `hybrid` is what a tool-calling target gets.
export interface SkillPreview {
  selection: "lexical" | "hybrid";
  candidates: (Named & { score: number })[]; always: Named[]; selected: (Named & { score: number })[]; block: string | null; chars: number;
  hybrid: { preloaded: Named[]; loadable: string[]; block: string | null; chars: number } | null;
}

// docs/contracts/skills.md. Protected by the global dashboard guard.
@Controller("api/tooling/skills")
export class SkillsController {
  constructor(private readonly skills: SkillsRepository, private readonly context: SkillContext, private readonly settings: SettingsRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<SkillSummary[]> {
    return this.skills.list();
  }

  // What automatic selection would add for this text, whether or not it is switched on. No vendor call.
  @Post("preview")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async preview(@Body() body: unknown): Promise<SkillPreview> {
    const text = typeof body === "object" && body !== null ? Reflect.get(body, "text") : undefined;
    if (typeof text !== "string" || !text.trim() || text.length > MAX_PREVIEW_CHARS) throw invalid(`text must be 1-${MAX_PREVIEW_CHARS} characters.`);
    const settings = await this.settings.get();
    const { plan, hybrid } = await this.context.session(text, settings);
    const round = (item: { id: string; name: string; score: number }) => ({ ...item, score: Math.round(item.score * 1000) / 1000 });
    return {
      selection: settings.skillsSelection,
      candidates: plan.scored.slice(0, 10).map(round), always: plan.always, selected: plan.applied.map(round), block: plan.block, chars: plan.block?.length ?? 0,
      hybrid: hybrid && { preloaded: [...hybrid.preloaded], loadable: [...hybrid.names], block: hybrid.block, chars: hybrid.block?.length ?? 0 },
    };
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async get(@Param("id") id: string): Promise<SkillDetail> {
    const skill = await this.skills.get(id);
    if (!skill) throw notFound();
    return skill;
  }

  // A link is fetched once on save; a failed fetch is recorded on the skill and does not fail the save.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<SkillDetail> {
    const parsed = parseSkill(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const created = await this.skills.create(parsed.value);
    if (created === "limit") throw new ConflictException({ code: "SKILL_LIMIT", message: `At most ${MAX_SKILLS} skills can be saved.` });
    if (created === "exists") throw exists();
    if (created === "always-limit") throw alwaysLimit();
    if (created.source !== "link" || !created.url) return created;
    await this.context.fetchLink(created.id, created.url);
    return (await this.skills.get(created.id)) ?? created;
  }

  // A link saved before raw GitHub URLs were derived still points at the web page; refreshing moves it (which drops the
  // cached page) before fetching.
  @Post(":id/refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Param("id") id: string): Promise<SkillDetail> {
    const current = await this.skills.get(id);
    if (!current) throw notFound();
    if (current.source !== "link" || !current.url) throw invalid("Only a link skill can be refreshed.");
    const url = rawSkillUrl(current.url);
    if (url !== current.url && typeof (await this.skills.update(id, { url })) === "string") throw notFound();
    const outcome = await this.context.fetchLink(id, url);
    if (!outcome.ok) throw new BadGatewayException({ code: "SKILL_FETCH_FAILED", message: outcome.message });
    return (await this.skills.get(id)) ?? current;
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
    if (updated === "always-limit") throw alwaysLimit();
    if (updated.source !== "link" || !updated.url || updated.url === current.url) return updated;
    await this.context.fetchLink(id, updated.url);
    return (await this.skills.get(id)) ?? updated;
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
