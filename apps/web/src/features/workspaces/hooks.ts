import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Workspace } from "@andamo/shared";
import { getErrorMessage } from "@/lib/api-client";
import { workspacesApi } from "./api";

export const wsKeys = {
  all: ["workspaces"] as const,
  members: (id: string) => ["workspaces", id, "members"] as const,
  invitations: (id: string) => ["workspaces", id, "invitations"] as const,
  teams: (id: string) => ["workspaces", id, "teams"] as const,
  labels: (id: string) => ["workspaces", id, "labels"] as const,
  projects: (id: string, view = "active") => ["workspaces", id, "projects", view] as const,
  project: (id: string, projectId: string) => ["workspaces", id, "project", projectId] as const,
  dashboard: (id: string) => ["workspaces", id, "dashboard"] as const,
  activity: (id: string) => ["workspaces", id, "activity"] as const,
};

export function useWorkspaces(enabled = true) {
  return useQuery({ queryKey: wsKeys.all, queryFn: workspacesApi.list, enabled, staleTime: 60_000 });
}

/** Workspace da rota atual (fornecido pelo layout do app). */
export const CurrentWorkspaceContext = createContext<Workspace | null>(null);

export function useCurrentWorkspace(): Workspace {
  const ws = useContext(CurrentWorkspaceContext);
  if (!ws) throw new Error("useCurrentWorkspace fora de um workspace");
  return ws;
}

export function useMembers(workspaceId: string) {
  return useQuery({ queryKey: wsKeys.members(workspaceId), queryFn: () => workspacesApi.members(workspaceId), staleTime: 60_000 });
}

export function useLabels(workspaceId: string) {
  return useQuery({ queryKey: wsKeys.labels(workspaceId), queryFn: () => workspacesApi.labels(workspaceId), staleTime: 60_000 });
}

export function useTeams(workspaceId: string) {
  return useQuery({ queryKey: wsKeys.teams(workspaceId), queryFn: () => workspacesApi.teams(workspaceId) });
}

export function useProjects(workspaceId: string, view: "active" | "archived" | "templates" = "active") {
  return useQuery({ queryKey: wsKeys.projects(workspaceId, view), queryFn: () => workspacesApi.projects(workspaceId, view) });
}

export function useProject(workspaceId: string, projectId: string) {
  return useQuery({ queryKey: wsKeys.project(workspaceId, projectId), queryFn: () => workspacesApi.project(workspaceId, projectId) });
}

/** Mutação com toast de erro padrão e invalidação das chaves informadas. */
export function useWsMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { invalidate?: ReadonlyArray<readonly unknown[]>; success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
      opts.onSuccess?.(result);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => Promise.all((opts.invalidate ?? []).map((key) => qc.invalidateQueries({ queryKey: key }))),
  });
}
