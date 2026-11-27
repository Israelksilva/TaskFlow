import type { Attachment, BillingInfo, CheckoutInput, CreateAttachmentInput, StorageUsage, Subscription } from "@andamo/shared";
import { apiRequest } from "@/lib/api-client";

export const filesApi = {
  list: (ws: string, q: { projectId?: string; taskId?: string }) =>
    apiRequest<{ attachments: Attachment[] }>(`/v1/workspaces/${ws}/arquivos`, { query: q }).then((r) => r.attachments),
  usage: (ws: string) => apiRequest<StorageUsage>(`/v1/workspaces/${ws}/arquivos/uso`),
  create: (ws: string, input: CreateAttachmentInput) =>
    apiRequest<{ id: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> }>(`/v1/workspaces/${ws}/arquivos`, { method: "POST", body: input }),
  complete: (ws: string, id: string) => apiRequest<{ attachment: Attachment }>(`/v1/workspaces/${ws}/arquivos/${id}/concluir`, { method: "POST" }).then((r) => r.attachment),
  download: (ws: string, id: string) => apiRequest<{ url: string }>(`/v1/workspaces/${ws}/arquivos/${id}/download`),
  remove: (ws: string, id: string) => apiRequest<void>(`/v1/workspaces/${ws}/arquivos/${id}`, { method: "DELETE" }),
};

/**
 * Envia um arquivo direto ao armazenamento (R2) pela URL pré-assinada e confirma na API.
 * O arquivo nunca passa pelo servidor do Andamo; as chaves do bucket nunca chegam ao navegador.
 */
export async function uploadFile(ws: string, file: File, target: { projectId: string; taskId?: string }): Promise<Attachment> {
  const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : "application/octet-stream";
  const slot = await filesApi.create(ws, { ...target, fileName: file.name, contentType, sizeBytes: file.size });
  const put = await fetch(slot.uploadUrl, { method: "PUT", headers: slot.headers, body: file });
  if (!put.ok) throw new Error(`Falha no envio para o armazenamento (${put.status}). Tente novamente.`);
  return filesApi.complete(ws, slot.id);
}

export const billingApi = {
  info: (ws: string) => apiRequest<BillingInfo>(`/v1/workspaces/${ws}/assinatura`),
  checkout: (ws: string, input: CheckoutInput) =>
    apiRequest<{ checkoutUrl: string; subscription: Subscription }>(`/v1/workspaces/${ws}/assinatura/checkout`, { method: "POST", body: input }),
  sync: (ws: string) => apiRequest<BillingInfo>(`/v1/workspaces/${ws}/assinatura/sincronizar`, { method: "POST" }),
  cancel: (ws: string) => apiRequest<BillingInfo>(`/v1/workspaces/${ws}/assinatura/cancelar`, { method: "POST" }),
};
