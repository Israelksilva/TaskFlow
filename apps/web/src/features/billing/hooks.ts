import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/features/files/api";

export const billingKey = (ws: string) => ["billing", ws] as const;

/** Assinatura do workspace (somente o proprietário). Nesta versão, só modo de teste do Mercado Pago. */
export function useBilling(ws: string, enabled: boolean) {
  return useQuery({ queryKey: billingKey(ws), queryFn: () => billingApi.info(ws), enabled });
}
