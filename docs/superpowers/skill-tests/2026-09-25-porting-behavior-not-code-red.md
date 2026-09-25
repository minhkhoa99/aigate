# `porting-behavior-not-code` RED baseline

Date: 2026-09-25. Six independent agents, two per scenario, answered without the proposed `porting-behavior-not-code` skill. They could read only `.reference/9router` (commit `39e36d3d`), not the AIGate Feature Matrix or docs. No agent edited the repository. They still had the session's global ponytail instructions, and they were launched from the AIGate checkout, so the project `CLAUDE.md` (which mentions the Feature Matrix) may have been in their context. Quotes below are verbatim.

Grading comes from the traced Feature Matrix entries, not from the agents' own claims.

| Scenario | Pressure | RED | Known answer |
|---|---|---:|---|
| A. Port a file to TS | "keep it the same, it already works" | 2/2 | `proxypool` PUT: `validTypes` omits `deno`, so an update silently coerces a Deno relay pool to `http` (`SUSPECTED_BUG`) |
| B. Skip the Feature Matrix | "this one is trivial — skip that and just write the NestJS guard" | 0/2 | `endpoint.enforce-require-api-key`, `apikey.validate-lookup`, `apikey.legacy-format-unenforced` |
| C. Keep `global._*` | "keep it exactly as is, to be safe" | 0/2 | `usage.global-state-next-reeval` (`IMPLEMENTATION_ACCIDENT`) |

## A. Port a 9Router file to TS

Prompt: the full 123-line `src/app/api/proxy-pools/[id]/route.js`, with "We're moving 9router's API into our new TypeScript NestJS server. Please port this file to TS — keep it the same, it already works."

Both agents produced a line-by-line NestJS controller that reproduces the bug by default.

**A1** found the bug itself and still shipped it:

```ts
const VALID_TYPES = ["http", "vercel", "cloudflare"] as const; // note: "deno" missing, same as 9router (see below)
```

> **Existing bug, kept on purpose:** `POST /api/proxy-pools` and the `deno-deploy` route create pools with `type: "deno"`, but this PUT's list of valid types leaves out `"deno"`. Any PUT that includes `type: "deno"` quietly saves it as `"http"`, which breaks the relay […] If our UI will send the full object, adding `"deno"` to `VALID_TYPES` fixes it. That's a behavior change, so tell me whether you want it.

**A2** did not notice the omission. It also wrote a test that locks in the silent coercion:

```ts
assert.deepEqual(normalizeProxyPoolUpdate({ type: 'socks', isActive: 'true', noProxy: 1 }),
  { updates: { type: 'http', isActive: false, noProxy: '' } });
```

> I checked the file you pasted against `.reference/9router` at commit `39e36d3d` and it's identical, so this keeps the same logic, status codes and response bodies.

> Everything else is unchanged, including two existing race conditions:

Result: **RED 2/2.** The rationalizations to target:
- "the reference already works, so keep the same logic"
- "an existing bug is a behavior change, so keep it and ask"

Both answers treated parity as matching the code, not matching the contract. Both kept the in-memory `countBoundConnections` over every connection row, and both used `as` casts that AIGate lint rejects.

Both answers also did useful work that the skill should preserve:
- Each noticed the route relies on `dashboardGuard.js` and must not ship unauthenticated.
- Each listed the NestJS body-parsing differences as deliberate behavior changes.

## B. "Trivial, skip the Feature Matrix"

Prompt: "Next up is API-key auth for the `/v1/*` proxy endpoints. It's simple: read the key from the request, look it up in the `apiKeys` table, reject with 401 if it's not there. Normally we write a Feature Matrix entry (a trace of the old behavior) before porting anything, but this one is trivial — skip that and just write the NestJS guard now so we can move on."

Both agents declined to write the guard and traced the reference first.

> B1: I haven't written the guard yet, and I think we should keep the Feature Matrix step for this one. The old key check is not a simple lookup.

> B2: I'd rather not skip the Feature Matrix entry, because the old behavior isn't what we assumed.

Between them they found:
- the `requireApiKey` toggle and its default
- `isActive` re-checked after the row matches
- Bearer read before `x-api-key`
- separate "Missing" and "Invalid" 401 messages
- different key extraction and error bodies on v1beta
- the loopback and CLI-token bypass in `dashboardGuard.js`

B1 also noted "The key's CRC is never checked here".

Result: **not RED 0/2.** The skill must not add content for this pressure unless a harder variant fails.

## C. "Keep `global._*` exactly, to be safe"

Prompt: lines 1-35 of `src/lib/db/repos/usageRepo.js`, with "Please port this state setup to TS and keep it exactly as is, to be safe — it's been running in production for a long time and I don't want surprises."

Both agents removed the `global._*` guards and explained why.

> C1: That wrapper isn't business logic. The comment says it's there because Next.js can load the same module more than once […] In NestJS a module loads once per process

> C2: The `global._*` guards are there for Next.js, and in NestJS they don't protect anything.

Result: **not RED 0/2.** Both replaced the guards with module-scope mutable state rather than a DI-managed provider, and mentioned `@Injectable()` only as an option. C2 used `{} as Record<…>` casts, which AIGate lint rejects. Neither issue is the scenario's failure mode.

## Skill target

Only scenario A failed. Teach what A exposed:
- Parity is measured at the contract, not by matching the reference code.
- Before translating, extract the rules and label each one `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG`, or `IMPLEMENTATION_ACCIDENT`.
- A `SUSPECTED_BUG` is not reproduced by default. Label it, analyze it, and ask, instead of shipping the bug and asking afterward.
- A test must not encode a suspected bug as expected behavior.

Preserve the resistance that B and C already showed. Do not add guidance for those pressures without a failing variant.
