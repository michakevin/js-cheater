import js from "@eslint/js";
import globals from "globals";

const browserGlobals = Object.fromEntries(
  Object.entries(globals.browser).map(([key, value]) => [key.trim(), value]),
);

export default [
  js.configs.recommended,
  {
    ignores: ["dist/**"],
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: "module",
      globals: {
        ...browserGlobals,
        chrome: "readonly",
      },
    },
    rules: {},
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["scripts/templates/**/*.js"],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: "script",
      globals: {
        ...browserGlobals,
        chrome: "readonly",
        __DEBUG_VALUE__: "readonly",
      },
    },
    rules: {
      "no-redeclare": "off",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...browserGlobals,
        ...globals.jest,
        chrome: "readonly",
        global: "readonly",
        globalThis: "readonly",
      },
    },
  },
];
