import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta (E2E). Sobem uma API com banco **em memória** (PGlite) e o front em portas próprias,
 * então nunca tocam no banco real (o `.env` da API não é lido) e não brigam com o `npm run dev`.
 *
 *   npm run e2e            # roda tudo (headless)
 *   npm run e2e:ui         # modo interativo
 *
 * Localmente usa o Google Chrome instalado; no CI, o Chromium do Playwright (E2E_BROWSER=chromium).
 */
const API_PORT = 3399;
const WEB_PORT = 8099;
const useBundledChromium = process.env.E2E_BROWSER === "chromium";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // um banco em memória compartilhado: execução em série, cada teste cria seus próprios usuários
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(useBundledChromium ? {} : { channel: "chrome" }) } },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], ...(useBundledChromium ? {} : { channel: "chrome" }) },
    },
  ],
  webServer: [
    {
      // Sem --env-file: só as variáveis abaixo. Banco descartável em memória.
      command: "npx tsx src/server.ts",
      cwd: "apps/api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL: "pglite://memory",
        JWT_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        APP_URL: `http://localhost:${WEB_PORT}`,
        WORKER_POLL_MS: "500",
        LOG_LEVEL: "warn",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "apps/web",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
