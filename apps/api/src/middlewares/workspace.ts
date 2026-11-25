import type { RequestHandler } from "express";
import { can, type Permission } from "@andamo/shared";
import { workspaceRepository } from "../modules/workspaces/workspace.repository";
import { ForbiddenError, NotFoundError } from "../shared/errors";
import { getUserId, idParam } from "../shared/http";

/**
 * Isolamento multi-tenant: resolve `:workspaceId` e exige que o usuário seja membro.
 * Não-membros recebem 404 (não revelamos a existência de workspaces alheios).
 */
export const requireWorkspace: RequestHandler = async (req, _res, next) => {
  const workspaceId = idParam(req, "workspaceId", "Workspace");
  const membership = await workspaceRepository.membership(workspaceId, getUserId(req));
  if (!membership) throw new NotFoundError("Workspace");
  req.membership = {
    workspaceId,
    role: membership.role,
    plan: membership.plan,
    isPersonal: membership.is_personal,
    archived: Boolean(membership.archived_at),
  };
  next();
};

/** Exige uma permissão do RBAC. Workspaces arquivados ficam somente leitura. */
export function authorize(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const membership = req.membership;
    if (!membership || !can(membership.role, permission)) throw new ForbiddenError();
    if (membership.archived && req.method !== "GET" && permission !== "workspace.update") {
      throw new ForbiddenError("Este workspace está arquivado (somente leitura)", "WORKSPACE_ARCHIVED");
    }
    next();
  };
}

/** Bloqueia escrita em workspace arquivado para rotas sem permissão específica. */
export const writable: RequestHandler = (req, _res, next) => {
  if (req.membership?.archived && req.method !== "GET") {
    throw new ForbiddenError("Este workspace está arquivado (somente leitura)", "WORKSPACE_ARCHIVED");
  }
  next();
};
