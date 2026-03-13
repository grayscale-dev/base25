import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.mjs",
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.{js,jsx,ts,tsx}"],
    },
  },
  {
    extends: "./vitest.config.mjs",
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.{js,jsx,ts,tsx}"],
    },
  },
  {
    extends: "./vitest.config.mjs",
    test: {
      name: "middleware",
      include: ["tests/middleware/**/*.test.{js,jsx,ts,tsx}"],
    },
  },
]);
