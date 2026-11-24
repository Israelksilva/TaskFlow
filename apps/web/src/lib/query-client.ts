import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Não insiste em erros do cliente (4xx): só em falhas de rede/servidor.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
    mutations: { retry: false },
  },
});
