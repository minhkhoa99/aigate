import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();
const filePath = "apps/web/src/features/lint_sample/entry.ts";

async function expectRule(source, ruleId, path = filePath) {
  const [result] = await eslint.lintText(source, { filePath: path });
  assert.ok(result.messages.some((message) => message.ruleId === ruleId), `${ruleId} did not reject: ${source.slice(0, 80)}`);
}

test("unbounded fan-out and fetch without timeout fail lint", async () => {
  await expectRule("Promise.all(items.map(send));", "aigate/bounded-promise-all");
  await expectRule("Promise.all([...items.map(send)]);", "aigate/bounded-promise-all");
  await expectRule("fetch('/api');", "aigate/fetch-timeout");
  await expectRule("fetch('/api', { signal: controller.signal });", "aigate/fetch-timeout");
  await expectRule("fetch('/api', { signal: ctx.signal });", "aigate/fetch-timeout");
});

test("secret logging, empty catch, and any fail lint", async () => {
  await expectRule("console.log(apiKey);", "aigate/no-secret-logging");
  await expectRule("try { work(); } catch (error) {}", "no-empty");
  await expectRule("const value: any = 1;", "@typescript-eslint/no-explicit-any");
  await expectRule("const value = input as string;", "aigate/no-type-assertion");
});

test("unbounded or wildcard repository SELECT fails lint", async () => {
  const repo = "apps/server/src/modules/usage/infrastructure/usage-repo.ts";
  await expectRule('db.query("SELECT * FROM usage");', "aigate/bounded-query", repo);
});

test("Drizzle repository selects need explicit columns and a row bound", async () => {
  const repo = "apps/server/src/modules/settings/infrastructure/settings.repo.ts";
  await expectRule("db.select().from(settings).limit(1);", "aigate/bounded-query", repo);
  await expectRule("db.select({ id: t.id }).from(t).where(x);", "aigate/bounded-query", repo);
  await expectRule("await db.selectDistinct({ id: t.id }).from(t).orderBy(t.id);", "aigate/bounded-query", repo);
  for (const source of ["db.select({ id: t.id }).from(t).where(x).limit(10);", "db.select({ id: t.id }).from(t).where(x).get();"]) {
    const [result] = await eslint.lintText(source, { filePath: repo });
    assert.deepEqual(result.messages, [], source);
  }
});

test("server and engine code fetch only through the transport, with a timeout", async () => {
  await expectRule("await fetch(url, { signal: AbortSignal.timeout(1000) });", "aigate/fetch-through-transport", "apps/server/src/modules/routing/infrastructure/chat.ts");
  await expectRule("await fetch(url, { signal: AbortSignal.timeout(1000) });", "aigate/fetch-through-transport", "packages/engine/src/adapters/openai.ts");
  const transport = "apps/server/src/modules/transport/infrastructure/direct-transport.ts";
  const [ok] = await eslint.lintText("await fetch(url, { signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(ms)]) });", { filePath: transport });
  assert.deepEqual(ok.messages, [], "the transport may fetch with a combined deadline");
  await expectRule("await fetch(url, { signal: AbortSignal.any([ctx.signal]) });", "aigate/fetch-timeout", transport);
});

test("retry loops must go through withRetry", async () => {
  const loop = "for (let i = 0; i < 3; i++) { try { return await call(); } catch (error) { last = error; } }";
  await expectRule(loop, "aigate/retry-through-helper", "apps/server/src/modules/connections/infrastructure/refresh.ts");
  await expectRule("while (true) { try { await send(); break; } catch { await sleep(10); } }", "aigate/retry-through-helper", "packages/engine/src/adapters/openai.ts");
  for (const [source, path] of [
    [loop, "packages/engine/src/retry.ts"],
    ["for (const item of items) total += item;", "apps/server/src/modules/usage/infrastructure/sum.ts"],
    ["try { await call(); } catch (error) { log(error); }", "apps/server/src/modules/usage/infrastructure/once.ts"],
  ]) {
    const [result] = await eslint.lintText(source, { filePath: path });
    assert.deepEqual(result.messages.filter((m) => m.ruleId === "aigate/retry-through-helper"), [], path);
  }
});

test("bounded operations pass and opaque fetch signals fail lint", async () => {
  const source = "Promise.all([a(), b()]); fetch('/api', { signal: AbortSignal.timeout(1000) }); const modes = ['a'] as const; console.log(monkey, modes);";
  const [result] = await eslint.lintText(source, { filePath });
  assert.deepEqual(result.messages, []);
  await expectRule("fetch('/api', { signal: ctx.signal });", "aigate/fetch-timeout", "apps/server/src/modules/engine/infrastructure/provider.ts");
  const [repo] = await eslint.lintText('db.query("SELECT id FROM usage LIMIT 10");', { filePath: "apps/server/src/modules/usage/infrastructure/usage-repo.ts" });
  assert.deepEqual(repo.messages, []);
});

test("feature-to-feature import fails lint", async () => {
  const featuresDir = resolve("apps/web/src/features");
  const fixtureDir = await mkdtemp(join(featuresDir, "lint_sample_"));
  try {
    const fixture = join(fixtureDir, "entry.ts");
    await writeFile(fixture, 'import "../providers/catalog.ts";\n');
    const [result] = await eslint.lintFiles([fixture]);
    assert.ok(result.messages.some((message) => message.ruleId === "boundaries/dependencies"), JSON.stringify(result.messages));
  } finally {
    assert.ok(fixtureDir.startsWith(featuresDir + sep));
    await rm(fixtureDir, { recursive: true });
  }
});

test("oversized route component fails lint", async () => {
  await expectRule("export const x = 1;\n".repeat(201), "max-lines", "apps/web/src/features/lint_sample/routes/page.tsx");
});

test("the lint command itself exits nonzero on a violating file in the tree", async () => {
  const featuresDir = resolve("apps/web/src/features");
  const fixtureDir = await mkdtemp(join(featuresDir, "lint_sample_"));
  try {
    await writeFile(join(fixtureDir, "entry.ts"), "Promise.all([...items.map(send)]);\n");
    assert.throws(
      () => execFileSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "apps", "tools"], { stdio: "pipe" }),
      (error) => error.status === 1 && error.stdout.toString().includes("aigate/bounded-promise-all"),
    );
  } finally {
    assert.ok(fixtureDir.startsWith(featuresDir + sep));
    await rm(fixtureDir, { recursive: true });
  }
});

test("the lint command passes once the violating file is gone", () => {
  execFileSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "apps", "tools"], { stdio: "pipe" });
});

test("engine import of any npm package fails dependency check", () => {
  assert.throws(
    () => execFileSync(process.execPath, ["node_modules/dependency-cruiser/bin/dependency-cruiser.mjs", "--config", ".dependency-cruiser.cjs", "--output-type", "err", "tools/lint/fixtures/engine"], { stdio: "pipe" }),
    (error) => error.status === 1 && error.stdout.toString().includes("engine-framework-free"),
  );
});

test("domain import of vendor package fails dependency check", () => {
  assert.throws(
    () => execFileSync(process.execPath, ["node_modules/dependency-cruiser/bin/dependency-cruiser.mjs", "--config", ".dependency-cruiser.cjs", "--output-type", "err", "tools/lint/fixtures/domain"], { stdio: "pipe" }),
    (error) => error.status === 1 && error.stdout.toString().includes("domain-no-vendor-sdk"),
  );
});
