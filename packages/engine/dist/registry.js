// Provider registry schema (spec §2 "schema thiết kế mới"). Entries are static data checked once at
// build time: defineRegistry() rejects a bad entry loudly instead of letting it fail per request.
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Model ids keep vendor spelling (dots, colons, slashes), but stay bounded and printable.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
export class RegistryError extends Error {
    problems;
    constructor(problems) {
        super(`Invalid provider registry:\n- ${problems.join("\n- ")}`);
        this.name = "RegistryError";
        this.problems = problems;
    }
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
function checkProvider(provider, problems) {
    const where = `provider ${provider.id}`;
    if (!PROVIDER_ID.test(provider.id))
        problems.push(`${where}: id must match ${PROVIDER_ID}`);
    let url;
    try {
        url = new URL(provider.baseUrl);
    }
    catch {
        problems.push(`${where}: baseUrl is not a URL`);
    }
    if (url && url.protocol !== "https:")
        problems.push(`${where}: baseUrl must use https`);
    if (provider.models.length === 0)
        problems.push(`${where}: needs at least one model`);
    const seen = new Set();
    for (const model of provider.models) {
        const at = `${where} model ${model.id}`;
        if (!MODEL_ID.test(model.id))
            problems.push(`${at}: id must match ${MODEL_ID}`);
        if (seen.has(model.id))
            problems.push(`${at}: duplicate model id`);
        seen.add(model.id);
        if (!isPositiveInteger(model.contextWindow))
            problems.push(`${at}: contextWindow must be a positive integer`);
        if (!isPositiveInteger(model.maxOutputTokens))
            problems.push(`${at}: maxOutputTokens must be a positive integer`);
        if (model.maxOutputTokens > model.contextWindow)
            problems.push(`${at}: maxOutputTokens exceeds contextWindow`);
    }
}
export function defineRegistry(providers) {
    const problems = [];
    const byId = new Map();
    for (const provider of providers) {
        checkProvider(provider, problems);
        if (byId.has(provider.id))
            problems.push(`provider ${provider.id}: duplicate provider id`);
        byId.set(provider.id, provider);
    }
    if (problems.length > 0)
        throw new RegistryError(problems);
    const models = new Map(providers.map((p) => [p.id, new Map(p.models.map((m) => [m.id, m]))]));
    return {
        providers,
        provider: (id) => byId.get(id),
        model: (providerId, modelId) => models.get(providerId)?.get(modelId),
    };
}
//# sourceMappingURL=registry.js.map