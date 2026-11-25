import type { Comment, Project, Role, Task } from "@andamo/shared";
import { logger } from "../lib/logger";

/** Eventos de domínio emitidos pelos services após o COMMIT. */
export interface DomainEvents {
  "task.created": { task: Task; actorId: string };
  "task.updated": { before: Task; after: Task; actorId: string };
  "task.deleted": { task: Task; actorId: string; permanent: boolean };
  "task.restored": { task: Task; actorId: string };
  "comment.created": { comment: Comment; task: Task; actorId: string; mentionIds: string[] };
  "project.created": { project: Project; actorId: string };
  "project.updated": { before: Project; after: Project; actorId: string };
  "project.deleted": { project: Project; actorId: string };
  "member.invited": { workspaceId: string; email: string; role: Role; actorId: string; userId: string | null };
  "member.joined": { workspaceId: string; userId: string; actorId: string };
  "member.role_changed": { workspaceId: string; userId: string; from: Role; to: Role; actorId: string };
  "member.removed": { workspaceId: string; userId: string; actorId: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

const handlers = new Map<keyof DomainEvents, Handler<keyof DomainEvents>[]>();

export function on<K extends keyof DomainEvents>(event: K, handler: Handler<K>) {
  const list = handlers.get(event) ?? [];
  list.push(handler as Handler<keyof DomainEvents>);
  handlers.set(event, list);
}

/**
 * Executa todos os assinantes. Falhas são registradas, mas não desfazem a operação
 * principal (que já foi gravada). Entregas críticas passam pela fila de jobs, com retry.
 */
export async function emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> {
  for (const handler of handlers.get(event) ?? []) {
    try {
      await handler(payload);
    } catch (error) {
      logger.error({ err: error, event }, "Falha em assinante de evento");
    }
  }
}
