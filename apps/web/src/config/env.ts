/** Somente variáveis públicas (VITE_*). A URL do banco nunca chega ao front-end. */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, ""),
} as const;
