import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // globalSetup omitted — legacy tests (_legacy/) need Docker;
    // new co-located unit tests run without any external dependency.
  },
});
