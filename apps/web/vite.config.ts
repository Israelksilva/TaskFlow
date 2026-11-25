import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const DEFAULT_SITE_URL = "https://israelksilva.github.io/TaskFlow/";

/**
 * Metadados de SEO e segurança no index.html.
 * - SITE_URL: endereço público do site (canonical, Open Graph, sitemap).
 * - CSP via <meta> só no build de produção: o GitHub Pages não permite cabeçalhos HTTP (S-07).
 */
function siteMeta(siteUrl: string, apiUrl: string, isBuild: boolean): Plugin {
  const site = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  let apiOrigin = "";
  try {
    apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : "";
  } catch {
    apiOrigin = "";
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    name: "andamo-site-meta",
    transformIndexHtml(html) {
      let out = html.replaceAll("%SITE_URL%", site);
      if (isBuild) {
        out = out.replace(
          "<!-- CSP -->",
          `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        );
      }
      return out;
    },
    generateBundle() {
      // sitemap.xml com a URL pública configurada (as rotas do app usam #, então só a raiz é indexável).
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`,
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = env.VITE_SITE_URL || DEFAULT_SITE_URL;

  return {
    // GitHub Pages publica em /<nome-do-repositório>/ (BASE_PATH); em desenvolvimento, na raiz.
    base: mode === "production" ? env.BASE_PATH || "/TaskFlow/" : "/",

    server: {
      host: "::",
      port: 8080,
      // Em desenvolvimento, /api/* é repassado à API local (sem CORS e sem expor URLs).
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:3333",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },

    plugins: [react(), siteMeta(siteUrl, env.VITE_API_URL || "", command === "build")],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
  };
});
