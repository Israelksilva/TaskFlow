# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [2.0.0] — não publicado (branch `saas/evolucao`)

### Adicionado
- Multi-tenant: workspaces, membros, convites por e-mail, equipes, etiquetas, transferência de propriedade,
  arquivamento; RBAC com 6 papéis; limites por plano (Free/Pro/Business).
- Projetos com templates, duplicação, arquivo e progresso; tarefas com subtarefas, checklist, dependências,
  seguidores, recorrência, lixeira, arquivo, conflito de edição, ações em massa.
- Visualizações Lista, Tabela, Timeline/Gantt e Calendário (mês/semana/dia/agenda, exportação .ics).
- Comentários com @menções, respostas e reações; presença e atualizações em tempo real (WebSocket).
- Central de notificações, preferências, horário silencioso, não perturbe, lembretes configuráveis,
  Web Push (VAPID) e e-mail (Resend) por fila durável no PostgreSQL.
- Autenticação: refresh token rotativo, sessões, 2FA TOTP, Google (opcional), verificação de e-mail,
  recuperação de senha, bloqueio por força bruta, onboarding, exportação e exclusão de conta (LGPD).
- Dashboard com dados reais, busca global (Ctrl+K), landing comercial, páginas legais, central de ajuda.
- PWA (manifest, service worker, offline), OpenAPI, `/health/ready`, Docker, docker-compose, CI ampliado.

- Colunas personalizáveis no Kanban (categoria, limite WIP, cor, reordenação, exclusão movendo tarefas).
- Controle de tempo: cronômetro por tarefa (um por pessoa), registro manual, estimado × realizado,
  página com horas por dia/projeto/pessoa e exportação CSV.

### Alterado
- API versionada em `/v1`; rotas `/auth` e `/tarefas` mantidas por compatibilidade.
- Access token passou a durar 15 min (antes 7 dias) — sessões antigas precisam entrar de novo uma vez.
- Excluir tarefa envia para a lixeira (restaurável).
- Prioridade "Urgente" adicionada.

### Migração de dados
- `002_saas_foundation.sql` (aditiva): cada usuário existente recebe um workspace pessoal com o projeto
  "Minhas tarefas" contendo todas as suas tarefas, na mesma ordem.
- `003_columns_and_time.sql` (aditiva): cada projeto ganha as colunas A Fazer / Em Progresso / Concluído e cada
  tarefa aponta para a coluna da sua categoria; cria `time_entries`.

## [1.0.0] — 2026-11-24
- Andamo full stack (React + Express + PostgreSQL/Neon), quadro Kanban com arrastar e soltar.
