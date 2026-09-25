import { defineConfig } from "drizzle-kit";

// ponytail: points at the conformance fixture until the real AIGate schema lands.
export default defineConfig({ dialect: "sqlite", schema: "./test/fixture/schema.ts", out: "./test/fixture/drizzle" });
