import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Cada arquivo de teste roda com seu próprio PostgreSQL em memória (PGlite).
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "pglite://memory",
      JWT_SECRET: "test-secret-with-at-least-32-characters!!",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGIN: "http://localhost:8080",
      LOG_LEVEL: "silent",
    },
  },
});
