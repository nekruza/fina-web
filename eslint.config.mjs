import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artifacts.
    "e2e/.results/**",
    "e2e/.report/**",
    // Generated reports and local tooling, not app code.
    "coverage/**",
    ".claude/**",
    ".remember/**",
    "_bmad/**",
    "_bmad-output/**",
  ]),
  {
    // CommonJS config files loaded directly by Node/Jest.
    files: ["*.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Playwright's fixture API hands you a function named `use`, which the
    // React hooks rule mistakes for a hook call. No React here.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]);

export default eslintConfig;
