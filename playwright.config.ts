import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do fluxo atual (baseline da Fase 1). Sobe a API com Postgres embutido em
 * memória e o front em modo dev com proxy para essa API. Nenhum dado real.
 *
 * PW_CHANNEL=chrome usa o Chrome instalado no sistema em vez do Chromium do Playwright.
 */
const API_PORT = 3399;
const WEB_PORT = 8090;
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: "apps/api",
      url: `http://localhost:${API_PORT}/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL: "pglite://memory",
        JWT_SECRET: "e2e-somente-para-testes-locais-0123456789abcdef",
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        RATE_LIMIT_PER_MINUTE: "100000",
        CONTACT_LIMIT_PER_HOUR: "100000",
        AUTH_LIMIT_PER_15MIN: "100000",
        LOG_LEVEL: "warn",
      },
    },
    {
      command: `npm run dev -w @andamo/web -- --port ${WEB_PORT} --strictPort --host localhost`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
