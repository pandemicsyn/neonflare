/**
 * ESLint configuration for Neonflare monorepo
 * Focused on TypeScript/Node.js development
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
  
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  
  plugins: ["@typescript-eslint"],
  
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
  },
};
