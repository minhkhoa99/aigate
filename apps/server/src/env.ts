import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Imported first by main.ts, so every setting below is in process.env before any module reads it. The file is the
// repository's .env (apps/server/dist -> ../../..), or AIGATE_ENV_FILE; see .env.example. Variables already set in the
// environment win over the file, as with node --env-file.
const file = process.env.AIGATE_ENV_FILE ?? fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(file)) process.loadEnvFile(file);
