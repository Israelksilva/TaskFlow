/**
 * RBAC do workspace. A API valida tudo no servidor; o front-end usa a mesma
 * tabela apenas para esconder ações que o usuário não pode executar.
 */
export const ROLES = ["owner", "admin", "manager", "member", "guest", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  member: "Membro",
  guest: "Convidado",
  viewer: "Visualizador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Controle total, inclusive cobrança, exclusão e transferência do workspace.",
  admin: "Gerencia membros, equipes, projetos e configurações.",
  manager: "Cria e gerencia projetos e equipes; convida membros.",
  member: "Cria e edita tarefas e projetos próprios; comenta.",
  guest: "Vê o workspace, comenta e edita apenas tarefas atribuídas a si.",
  viewer: "Somente leitura.",
};

const RANK: Record<Role, number> = { owner: 6, admin: 5, manager: 4, member: 3, guest: 2, viewer: 1 };

export const PERMISSIONS = {
  "workspace.update": "admin",
  "workspace.delete": "owner",
  "workspace.transfer": "owner",
  "workspace.billing": "owner",
  "members.invite": "manager",
  "members.manage": "admin",
  "teams.manage": "manager",
  "labels.manage": "member",
  "projects.create": "member",
  "projects.manage": "manager",
  "tasks.create": "member",
  "tasks.edit": "member",
  "tasks.delete": "member",
  "tasks.editAssigned": "guest",
  "comments.create": "guest",
  "activity.read": "viewer",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function roleRank(role: Role): number {
  return RANK[role];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return Boolean(role) && RANK[role!] >= RANK[PERMISSIONS[permission]];
}

/** Papéis que `actor` pode atribuir a outros (nunca acima do próprio; "owner" só por transferência). */
export function assignableRoles(actor: Role): Role[] {
  return ROLES.filter((r) => r !== "owner" && RANK[r] <= RANK[actor] && (actor !== "manager" || RANK[r] <= RANK.member));
}
