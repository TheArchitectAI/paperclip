import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 60_000,
    testTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 3,
      },
    },
  },
});
