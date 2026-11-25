import { Router } from "express";
import { buildOpenApiSpec } from "./openapi";

// A versão vem do package.json via variável do npm quando disponível.
const spec = buildOpenApiSpec(process.env.npm_package_version ?? "1.0.0");

/**
 * `/v1/openapi.json`: especificação em JSON.
 * `/v1/docs`: página de referência (Scalar via CDN; CSP liberada só nesta rota).
 */
export const docsRoutes = Router();

docsRoutes.get("/openapi.json", (_req, res) => {
  res.json(spec);
});

docsRoutes.get("/docs", (_req, res) => {
  res
    .setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'",
    )
    .type("html").send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Andamo API · Referência</title>
  </head>
  <body>
    <script id="api-reference" data-url="openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"></script>
  </body>
</html>`);
});
