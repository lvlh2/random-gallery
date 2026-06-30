// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "jest.setup.ts", "src/__tests__/**", "__mocks__/**"],
  },
  {
    // Downgrade pre-existing issues from error to warning.
    // These rules are correct in principle but the existing code
    // uses these patterns intentionally. Remove these overrides
    // once the code is refactored.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
