import { openai } from "./providers/openai.js";
import { defineRegistry } from "./registry.js";

// Validated once at load; a bad entry fails startup, not a user request.
export const builtinRegistry = defineRegistry([openai]);
