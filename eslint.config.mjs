import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Allows unused vars with underscores
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // For TypeScript
    },
  },
];

export default eslintConfig;
