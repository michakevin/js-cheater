import js from "@eslint/js";
import globals from "globals";

const browserGlobals = Object.fromEntries(
  Object.entries(globals.browser).map(([key, value]) => [key.trim(), value])
);

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
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
];
