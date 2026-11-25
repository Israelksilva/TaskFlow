/**
 * Especificação OpenAPI 3.1 (resumo das rotas v1). Servida em GET /v1/openapi.json.
 * Os contratos detalhados (corpo/resposta) estão nos schemas Zod de `@andamo/shared`.
 */
type Op = [method: string, path: string, summary: string, tag: string, auth?: boolean];

const ops: Op[] = [
  ["get", "/health", "Liveness", "Infra", false],
  ["get", "/health/ready", "Readiness (banco, fila, integrações)", "Infra", false],
  ["get", "/v1/config", "Configuração pública e integrações ativas", "Infra", false],
  ["post", "/v1/contato", "Formulário de contato", "Público", false],
  ["post", "/v1/auth/cadastro", "Cadastro", "Auth", false],
  ["post", "/v1/auth/login", "Login (pode exigir 2FA)", "Auth", false],
  ["post", "/v1/auth/login/2fa", "Concluir login com código TOTP", "Auth", false],
  ["post", "/v1/auth/google", "Login com Google (ID token)", "Auth", false],
  ["post", "/v1/auth/refresh", "Renovar sessão (rotação do refresh token)", "Auth", false],
  ["post", "/v1/auth/esqueci-senha", "Solicitar redefinição de senha", "Auth", false],
  ["post", "/v1/auth/redefinir-senha", "Redefinir senha com token", "Auth", false],
  ["post", "/v1/auth/verificar-email", "Confirmar e-mail", "Auth", false],
  ["get", "/v1/auth/me", "Usuário autenticado", "Auth"],
  ["post", "/v1/auth/logout", "Encerrar sessão atual", "Auth"],
  ["patch", "/v1/auth/perfil", "Atualizar perfil", "Conta"],
  ["post", "/v1/auth/senha", "Alterar senha", "Conta"],
  ["get", "/v1/auth/sessoes", "Listar sessões ativas", "Conta"],
  ["post", "/v1/auth/sessoes/encerrar-outras", "Encerrar outras sessões", "Conta"],
  ["delete", "/v1/auth/sessoes/{id}", "Encerrar uma sessão", "Conta"],
  ["post", "/v1/auth/2fa/configurar", "Iniciar configuração de 2FA", "Conta"],
  ["post", "/v1/auth/2fa/ativar", "Ativar 2FA", "Conta"],
  ["post", "/v1/auth/2fa/desativar", "Desativar 2FA", "Conta"],
  ["get", "/v1/auth/exportar", "Exportar meus dados (LGPD)", "Conta"],
  ["post", "/v1/auth/excluir-conta", "Excluir conta (LGPD)", "Conta"],
  ["get", "/v1/workspaces", "Meus workspaces", "Workspaces"],
  ["post", "/v1/workspaces", "Criar workspace", "Workspaces"],
  ["get", "/v1/workspaces/{workspaceId}", "Detalhe do workspace", "Workspaces"],
  ["patch", "/v1/workspaces/{workspaceId}", "Atualizar nome/logo", "Workspaces"],
  ["post", "/v1/workspaces/{workspaceId}/arquivar", "Arquivar/desarquivar", "Workspaces"],
  ["post", "/v1/workspaces/{workspaceId}/transferir", "Transferir propriedade", "Workspaces"],
  ["get", "/v1/workspaces/{workspaceId}/dashboard", "Indicadores do dashboard", "Workspaces"],
  ["get", "/v1/workspaces/{workspaceId}/busca", "Busca global", "Workspaces"],
  ["get", "/v1/workspaces/{workspaceId}/atividades", "Feed de atividades", "Workspaces"],
  ["get", "/v1/workspaces/{workspaceId}/membros", "Membros", "Equipe"],
  ["patch", "/v1/workspaces/{workspaceId}/membros/{userId}", "Atualizar papel/cargo", "Equipe"],
  ["delete", "/v1/workspaces/{workspaceId}/membros/{userId}", "Remover membro / sair", "Equipe"],
  ["get", "/v1/workspaces/{workspaceId}/convites", "Convites pendentes", "Equipe"],
  ["post", "/v1/workspaces/{workspaceId}/convites", "Convidar por e-mail", "Equipe"],
  ["delete", "/v1/workspaces/{workspaceId}/convites/{id}", "Revogar convite", "Equipe"],
  ["get", "/v1/workspaces/convites/{token}", "Pré-visualizar convite", "Equipe"],
  ["post", "/v1/workspaces/convites/aceitar", "Aceitar convite", "Equipe"],
  ["get", "/v1/workspaces/{workspaceId}/equipes", "Equipes", "Equipe"],
  ["post", "/v1/workspaces/{workspaceId}/equipes", "Criar equipe", "Equipe"],
  ["get", "/v1/workspaces/{workspaceId}/etiquetas", "Etiquetas", "Projetos"],
  ["get", "/v1/workspaces/{workspaceId}/projetos", "Projetos", "Projetos"],
  ["post", "/v1/workspaces/{workspaceId}/projetos", "Criar projeto (ou a partir de template)", "Projetos"],
  ["patch", "/v1/workspaces/{workspaceId}/projetos/{id}", "Atualizar projeto", "Projetos"],
  ["post", "/v1/workspaces/{workspaceId}/projetos/{id}/duplicar", "Duplicar projeto", "Projetos"],
  ["post", "/v1/workspaces/{workspaceId}/projetos/{id}/arquivar", "Arquivar projeto", "Projetos"],
  ["delete", "/v1/workspaces/{workspaceId}/projetos/{id}", "Excluir projeto", "Projetos"],
  ["get", "/v1/workspaces/{workspaceId}/tarefas", "Listar tarefas (filtros)", "Tarefas"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas", "Criar tarefa", "Tarefas"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas/lote", "Ações em massa", "Tarefas"],
  ["get", "/v1/workspaces/{workspaceId}/tarefas/{id}", "Detalhe da tarefa", "Tarefas"],
  ["patch", "/v1/workspaces/{workspaceId}/tarefas/{id}", "Atualizar/mover tarefa", "Tarefas"],
  ["delete", "/v1/workspaces/{workspaceId}/tarefas/{id}", "Enviar para a lixeira", "Tarefas"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas/{id}/restaurar", "Restaurar da lixeira", "Tarefas"],
  ["delete", "/v1/workspaces/{workspaceId}/tarefas/{id}/permanente", "Excluir definitivamente", "Tarefas"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas/{id}/duplicar", "Duplicar tarefa", "Tarefas"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas/{id}/checklist", "Adicionar item de checklist", "Tarefas"],
  ["get", "/v1/workspaces/{workspaceId}/tarefas/{taskId}/comentarios", "Comentários", "Colaboração"],
  ["post", "/v1/workspaces/{workspaceId}/tarefas/{taskId}/comentarios", "Comentar (com @menções)", "Colaboração"],
  ["get", "/v1/notificacoes", "Notificações (paginadas)", "Notificações"],
  ["get", "/v1/notificacoes/contagem", "Não lidas", "Notificações"],
  ["post", "/v1/notificacoes/lidas", "Marcar todas como lidas", "Notificações"],
  ["get", "/v1/notificacoes/preferencias", "Preferências", "Notificações"],
  ["put", "/v1/notificacoes/preferencias", "Atualizar preferências", "Notificações"],
  ["post", "/v1/notificacoes/push/inscricoes", "Registrar inscrição Web Push", "Notificações"],
];

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [method, path, summary, tag, auth = true] of ops) {
    paths[path] ??= {};
    paths[path][method] = {
      summary,
      tags: [tag],
      ...(auth ? { security: [{ bearer: [] }] } : {}),
      responses: { "200": { description: "OK" }, "4XX": { description: "Erro no formato { error: { code, message, details? } }" } },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Andamo API", version: "1.0.0", description: "API REST do Andamo. Tempo real via WebSocket em /v1/realtime." },
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths,
  };
}
