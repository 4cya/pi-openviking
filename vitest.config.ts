import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ["./tests/_legacy/global-setup.ts"],
  },
});
