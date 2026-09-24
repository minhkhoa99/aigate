import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import { aigateRules } from "./tools/lint/rules.mjs";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "graphify-out/**"] },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["apps/**/*.{ts,tsx}", "tools/**/*.{ts,tsx}"] })),
  {
    files: ["apps/**/*.{ts,tsx}", "tools/**/*.{ts,tsx}"],
    plugins: { aigate: { rules: aigateRules } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "aigate/bounded-promise-all": "error",
      "aigate/fetch-timeout": "error",
      "aigate/no-secret-logging": "error",
      "aigate/no-type-assertion": "error",
    },
  },
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [{ type: "feature", pattern: "apps/web/src/features/*", capture: ["feature"], partialMatch: false }],
      "boundaries/legacy-templates": false,
    },
    rules: {
      "boundaries/dependencies": ["error", {
        default: "allow",
        policies: [{
          from: { element: { type: "feature" } },
          disallow: { to: { element: { type: "feature", captured: { feature: "!{{ from.element.captured.feature }}" } } } },
        }],
      }],
    },
  },
  {
    files: ["apps/web/src/features/**/routes/**/*.{ts,tsx}"],
    rules: { "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["apps/*/src/modules/*/infrastructure/**/*repo*.ts"],
    rules: { "aigate/bounded-query": "error" },
  },
];
