#!/usr/bin/env node
// pnpm extract [verify] (docs/contracts/registry-extract.md). Verify needs packages/engine built.
import { extract } from "./extract.mjs";
import { verify } from "./verify.mjs";

if (process.argv[2] === "verify") {
  const result = await verify();
  console.log(result.report);
  process.exit(result.differences.length === 0 ? 0 : 1);
}
const done = await extract();
console.log(`wrote ${done.providers} providers, ${done.models} models from 9router ${done.version} (${done.commit.slice(0, 8)})`);
