import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.js"],
    clearMocks: true,
    restoreMocks: true,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{js,jsx,ts,tsx}",
        "app/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/.next/**",
        "**/tests/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
