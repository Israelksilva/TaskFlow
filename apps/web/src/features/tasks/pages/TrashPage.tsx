import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { can, type Task } from "@andamo/shared";
import { EmptyState } from "@/components/feedback/EmptyState";
import { InlineError } from "@/components/feedback/InlineError";
import { useCrumbs } from "@/components/layout/AppHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentWorkspace, useProjects, useWsMutation } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { tasksApi } from "../api";
import { taskKeys } from "../hooks";

/** Lixeira e arquivo: restaurar ou excluir definitivamente. */
export default function TrashPage() {
  const ws = useCurrentWorkspace();
  const [view, setView] = useState<"trash" | "archived">("trash");
  const [confirm, setConfirm] = useState<Task | null>(null);
  const projects = new Map((useProjects(ws.id).data ?? []).map((p) => [p.id, p]));
  useCrumbs([{ label: ws.name, to: `/app/w/${ws.id}` }, { label: "Lixeira e arquivo" }]);
  const query = { view, includeSubtasks: "true" } as const;
  const tasks = useQuery({ queryKey: taskKeys.list(ws.id, query), queryFn: () => tasksApi.list(ws.id, query) });
  const invalidate = [["tasks", ws.id], ["workspaces", ws.id]] as const;
  const restore = useWsMutation((t: Task) => (t.deletedAt ? tasksApi.restore(ws.id, t.id) : tasksApi.archive(ws.id, t.id, false)), { invalidate, success: "Tarefa restaurada" });
  const destroy = useWsMutation((t: Task) => tasksApi.destroy(ws.id, t.id), { invalidate, success: "Tarefa excluída definitivamente" });
  const canDelete = can(ws.role, "tasks.delete");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Lixeira e arquivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recupere tarefas excluídas ou arquivadas.</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="trash">Lixeira</TabsTrigger>
            <TabsTrigger value="archived">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tasks.isError && <InlineError>{getErrorMessage(tasks.error)}</InlineError>}
      {tasks.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !tasks.data?.length ? (
        <EmptyState icon={Trash2} title={view === "trash" ? "A lixeira está vazia" : "Nenhuma tarefa arquivada"} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {tasks.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {projects.get(t.projectId)?.name ?? "Projeto"} · {view === "trash" ? "excluída" : "arquivada"} {relativeTime((t.deletedAt ?? t.archivedAt)!)}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(t)}>
                <RotateCcw /> Restaurar
              </Button>
              {view === "trash" && canDelete && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(t)}>
                  <Trash2 /> Excluir
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>“{confirm?.title}” e seus comentários serão apagados para sempre. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirm && destroy.mutate(confirm)}>
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
