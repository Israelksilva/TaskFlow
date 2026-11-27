import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, File, FileImage, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { can, MAX_ATTACHMENT_BYTES, type Attachment, type Role } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api-client";
import { formatBytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { filesApi, uploadFile } from "./api";

const iconFor = (a: Attachment) => (a.contentType.startsWith("image/") ? FileImage : /pdf|text|word|document|sheet|excel|presentation/.test(a.contentType) ? FileText : File);

/**
 * Documentos do projeto (sem taskId) ou anexos de uma tarefa. Quem pode editar envia; todos os membros baixam;
 * quem enviou ou um gestor exclui. Sem armazenamento configurado, informa em vez de simular.
 */
export function AttachmentsPanel({
  workspaceId, projectId, taskId, role, userId, compact = false,
}: { workspaceId: string; projectId: string; taskId?: string; role: Role; userId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const key = ["files", workspaceId, taskId ?? `p:${projectId}`];
  const usage = useQuery({ queryKey: ["files-usage", workspaceId], queryFn: () => filesApi.usage(workspaceId), staleTime: 60_000 });
  const list = useQuery({ queryKey: key, queryFn: () => filesApi.list(workspaceId, taskId ? { taskId } : { projectId }), enabled: usage.data?.available === true });
  const canUpload = can(role, "tasks.edit");
  const canManage = can(role, "projects.manage");

  const remove = useMutation({
    mutationFn: (id: string) => filesApi.remove(workspaceId, id),
    onSuccess: () => {
      toast.success("Arquivo excluído");
      void qc.invalidateQueries({ queryKey: ["files", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["files-usage", workspaceId] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: arquivo maior que 50 MB`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        await uploadFile(workspaceId, file, { projectId, taskId });
        toast.success(`${file.name} enviado`);
      } catch (e) {
        toast.error(`${file.name}: ${getErrorMessage(e)}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (input.current) input.current.value = "";
    void qc.invalidateQueries({ queryKey: ["files", workspaceId] });
    void qc.invalidateQueries({ queryKey: ["files-usage", workspaceId] });
  }

  async function download(a: Attachment) {
    try {
      const { url } = await filesApi.download(workspaceId, a.id);
      window.location.assign(url); // URL de 60 s, servida como anexo
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  if (usage.isPending) return null;
  if (!usage.data?.available) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" aria-hidden /> Anexos indisponíveis: o armazenamento de arquivos ainda não foi configurado.
      </p>
    );
  }
  const items = list.data ?? [];
  const pct = Math.min(100, Math.round((usage.data.usedBytes / usage.data.limitBytes) * 100));

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-wrap items-center gap-2", compact ? "justify-between" : "")}>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple className="sr-only" id={`up-${taskId ?? projectId}`} onChange={(e) => void onFiles(e.target.files)} />
            <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading.length > 0}>
              {uploading.length ? <Loader2 className="animate-spin" /> : <Upload />} {compact ? "Anexar" : "Enviar arquivos"}
            </Button>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {formatBytes(usage.data.usedBytes)} de {formatBytes(usage.data.limitBytes)} usados ({pct}%) · até 50 MB por arquivo
        </span>
      </div>
      {uploading.map((n) => (
        <p key={n} className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando {n}…</p>
      ))}
      {list.isError && <p className="text-xs text-destructive">{getErrorMessage(list.error)}</p>}
      {items.length === 0 && !list.isPending && !uploading.length ? (
        <p className="text-xs text-muted-foreground">{taskId ? "Nenhum anexo nesta tarefa." : "Nenhum documento neste projeto ainda."}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {items.map((a) => {
            const Icon = iconFor(a);
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(a.sizeBytes)} · {a.uploadedBy?.name ?? "Conta removida"} · {relativeTime(a.createdAt)}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Baixar ${a.fileName}`} onClick={() => void download(a)}>
                  <Download />
                </Button>
                {(a.uploadedBy?.id === userId || canManage) && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${a.fileName}`} disabled={remove.isPending} onClick={() => remove.mutate(a.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
