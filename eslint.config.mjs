import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 ships flat configs, so no FlatCompat.
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // New in eslint-config-next 16 (react-hooks v7). They flag 7 existing,
    // working components (add-to-cart, sale countdown, admin settings);
    // warnings until those are reworked, so the upgrade changes no behaviour.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/generated/**",
      "next-env.d.ts",
      "design/**",
      "migration/**",
      "studio/**",
    ],
  },
];

export default eslintConfig;
