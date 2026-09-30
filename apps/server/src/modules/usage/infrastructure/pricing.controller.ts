import { BadRequestException, Body, Controller, Delete, Get, Header, Patch, Query } from "@nestjs/common";
import { parsePricingPatch } from "../domain/pricing.js";
import { PricingRepository, TooManyOverrides, type OverrideView } from "./pricing.repo.js";

// docs/contracts/usage.md "Dashboard API" (pricing.crud-api). Protected by the global dashboard guard.

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const id = (value: unknown): string | undefined => (typeof value === "string" && value.length >= 1 && value.length <= 200 ? value : undefined);

@Controller("api/pricing")
export class PricingController {
  constructor(private readonly pricing: PricingRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(): Promise<{ overrides: OverrideView[] }> {
    return { overrides: await this.pricing.list() };
  }

  @Get("resolve")
  @Header("Cache-Control", "no-store")
  resolve(@Query("provider") provider: unknown, @Query("model") model: unknown) {
    const providerId = id(provider);
    const modelId = id(model);
    if (!providerId || !modelId) throw invalid("Send provider and model, 1-200 characters each.");
    return this.pricing.price(providerId, modelId);
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  async patch(@Body() body: unknown): Promise<{ overrides: OverrideView[] }> {
    const parsed = parsePricingPatch(body);
    if (!parsed.ok) throw invalid(parsed.message);
    try {
      return { overrides: await this.pricing.apply(parsed.edits) };
    } catch (error) {
      if (error instanceof TooManyOverrides) throw invalid(error.message);
      throw error;
    }
  }

  // No query resets everything; provider alone resets that provider; provider and model reset one model.
  @Delete()
  @Header("Cache-Control", "no-store")
  async reset(@Query("provider") provider: unknown, @Query("model") model: unknown): Promise<{ overrides: OverrideView[] }> {
    if (provider === undefined && model !== undefined) throw invalid("model needs its provider.");
    if (provider !== undefined && !id(provider)) throw invalid("provider must be 1-200 characters.");
    if (model !== undefined && !id(model)) throw invalid("model must be 1-200 characters.");
    return { overrides: await this.pricing.reset(id(provider), id(model)) };
  }
}
