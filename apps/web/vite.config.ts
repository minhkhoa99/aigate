import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ponytail: keep in sync with DEFAULT_PORT in apps/server/src/main.ts.
const server = "http://127.0.0.1:20200";
const proxy = Object.fromEntries(["/api", "/v1", "/v1beta", "/codex", "/responses", "/health"].map((path) => [path, server]));

export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy } });
