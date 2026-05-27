import { fixupConfigRules } from "@eslint/compat";
import * as espree from "espree";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...fixupConfigRules(nextVitals),
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      "coverage/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      "react-hooks/incompatible-library": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      parser: espree,
      sourceType: "module",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      parser: espree,
      sourceType: "commonjs",
    },
  },
];

export default eslintConfig;
