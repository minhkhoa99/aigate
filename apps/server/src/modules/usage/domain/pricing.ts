import { PRICE_FIELDS, type PriceField, type PriceOverride } from "@aigate/engine";

// docs/contracts/usage.md "Pricing PATCH" (pricing.crud-api validation, kept from 9router).
export const MAX_PATCH_MODELS = 500;
export const MAX_OVERRIDES = 5_000;
const MAX_ID = 200;

export interface PriceEdit { readonly provider: string; readonly model: string; readonly fields: PriceOverride }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isField = (key: string): key is PriceField => PRICE_FIELDS.some((field) => field === key);
const validId = (id: string) => id.length >= 1 && id.length <= MAX_ID;

export function parsePricingPatch(body: unknown): { ok: true; edits: PriceEdit[] } | { ok: false; message: string } {
  if (!isObject(body)) return { ok: false, message: "Send { <provider>: { <model>: { input, output, cached, reasoning, cache_creation } } }." };
  const edits: PriceEdit[] = [];
  for (const [provider, models] of Object.entries(body)) {
    if (!validId(provider) || !isObject(models)) return { ok: false, message: `Provider "${provider.slice(0, MAX_ID)}" needs an object of models.` };
    for (const [model, rates] of Object.entries(models)) {
      if (!validId(model) || !isObject(rates)) return { ok: false, message: `${provider}/${model.slice(0, MAX_ID)} needs an object of rates.` };
      const fields: Partial<Record<PriceField, number>> = {};
      for (const [key, value] of Object.entries(rates)) {
        if (!isField(key)) return { ok: false, message: `Invalid pricing field: ${key.slice(0, 40)}. Use ${PRICE_FIELDS.join(", ")}.` };
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return { ok: false, message: `Invalid pricing for ${key} in ${provider}/${model}: a non-negative number is required.` };
        fields[key] = value;
      }
      if (Object.keys(fields).length === 0) return { ok: false, message: `${provider}/${model} sets no rate.` };
      edits.push({ provider, model, fields });
      if (edits.length > MAX_PATCH_MODELS) return { ok: false, message: `At most ${MAX_PATCH_MODELS} models per request.` };
    }
  }
  if (edits.length === 0) return { ok: false, message: "The body names no model." };
  return { ok: true, edits };
}
