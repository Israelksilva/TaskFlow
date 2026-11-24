import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    server: "src/server.ts",
    migrate: "src/db/migrate-cli.ts",
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é TypeScript puro: embutimos no bundle da API.
  noExternal: ["@andamo/shared"],
  // PGlite (Postgres embutido) só é carregado em dev/testes, sob demanda.
  external: ["@electric-sql/pglite"],
});
