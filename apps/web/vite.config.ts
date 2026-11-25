import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

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
          ws: true, // WebSocket do tempo real (/v1/realtime)
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },

    plugins: [react()],

    build: {
      rollupOptions: {
        output: {
          // Bibliotecas estáveis em chunks próprios: melhor cache entre deploys.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            query: ["@tanstack/react-query"],
            radix: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-popover", "@radix-ui/react-tooltip", "@radix-ui/react-tabs"],
            dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          },
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
  };
});
