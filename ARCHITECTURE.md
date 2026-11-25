# Arquitetura do Andamo

## Visão geral

```
GitHub Pages (SPA React, HashRouter)  ──HTTPS/JSON──▶  API Express (Render)  ──▶  PostgreSQL (Neon)
        │  Service Worker (push, cache)                 │  WebSocket /v1/realtime
        └──────────────── WSS ──────────────────────────┤  Worker de jobs (mesmo processo)
                                                        ├──▶ Resend (e-mail, opcional)
                                                        └──▶ Web Push (VAPID, opcional)
```

Monorepo (npm workspaces):

| Pacote | Papel |
|---|---|
| `packages/shared` | Fonte única de schemas Zod, DTOs, RBAC (`rbac.ts`), planos (`plans.ts`), regras do Kanban |
| `apps/api` | Monólito modular Express 5 + `pg` (SQL parametrizado) |
| `apps/web` | SPA React 18 + Vite + Tailwind/shadcn + React Query |

## API (`apps/api/src`)

```
config/env.ts        validação das variáveis (integrações opcionais desligadas sem credencial)
db/                  pg Pool | PGlite (dev/testes), migrador transacional (migrations/NNN_*.sql)
middlewares/         authenticate (JWT + sessão no banco), workspace (tenant + RBAC), erros
modules/<domínio>/   routes → controller/handlers → service → repository
  auth/              sessões, refresh rotativo, 2FA, Google, LGPD
  workspaces/        tenants, membros, convites, equipes, etiquetas, roteador v1
  projects/ tasks/ comments/ dashboard/ notifications/ email/ activity/ audit/ public/
events/bus.ts        eventos de domínio pós-COMMIT → assinantes (notificações, tempo real, lembretes)
jobs/                fila PostgreSQL (queue.ts) + worker com agendamentos (worker.ts)
realtime/hub.ts      WebSocket; auth pelo subprotocolo; canais por usuário e workspace; presença
```

### Multi-tenant
- Tenant = `workspace`. Toda rota `/v1/workspaces/:workspaceId/*` passa por `requireWorkspace`, que exige linha em
  `workspace_members` (senão **404**, sem revelar existência) e popula `req.membership` (papel, plano, arquivado).
- Repositórios sempre filtram por `workspace_id` (`findInWorkspace`), o que neutraliza IDOR mesmo com IDs válidos.
- Permissões finas no service (ex.: convidado edita só tarefas atribuídas a ele).
- Rotas legadas `/tarefas` operam no projeto padrão do workspace pessoal (compatibilidade com o cliente antigo).

### Sessões
Access token JWT (15 min, `sid` da sessão) + refresh token opaco (30 dias) guardado como SHA-256 em `sessions`.
Cada refresh rotaciona; reapresentar um token antigo revoga a sessão. `authenticate` confere a sessão no banco a
cada requisição, então revogar tem efeito imediato. O cliente renova em "single-flight" para não disparar a
detecção de reuso com requisições paralelas.

### Fila de jobs e lembretes
`jobs` com `dedupe_key UNIQUE` (idempotência), `FOR UPDATE SKIP LOCKED` (várias instâncias), backoff exponencial,
jobs travados retomados após 5 min. Agendamentos periódicos usam dedupe por janela de tempo. Lembretes de prazo
são jobs com `run_at` calculado no PostgreSQL a partir do fuso de cada usuário; mudanças de prazo cancelam e
reagendam; no disparo o job confere se o prazo ainda é o mesmo. Nada depende de timers em memória.

### Notificações
`notificationService.notify` → respeita preferências (categoria, projeto, canal) → grava com `dedupe_key` por
usuário → publica no WebSocket → enfileira `notification.deliver` (push/e-mail) que respeita horário silencioso,
"não perturbe", limite de frequência e remove inscrições push expiradas (404/410). E-mails passam por
`email.send` (retry) e têm o conteúdo apagado do job ao concluir.

## Web (`apps/web/src`)

```
components/layout/   AppShell (workspace atual, realtime, atalhos), Sidebar, AppHeader, CommandPalette
components/ui/       primitivos shadcn/Radix
features/<domínio>/  api.ts (cliente), hooks.ts (React Query), pages/ e components/
lib/                 api-client (refresh automático), markdown seguro, storage, hooks
public/              sw.js, manifest, offline.html, ícones
```
- Rotas: `/` landing · `/entrar` `/cadastro` … · `/app/w/:workspaceId/...` (app) · `?tarefa=<id>` abre o painel
  da tarefa em qualquer tela (links de notificações e push usam isso).
- O quadro Kanban original foi preservado e passou a ser escopado por `BoardScopeContext` (workspace+projeto).

## Decisões registradas
- **Fila no PostgreSQL em vez de Redis/BullMQ**: o plano atual (Render free + Neon) não tem Redis; volume baixo.
- **Tokens no `localStorage`** (não cookies): front e API estão em domínios diferentes (github.io × onrender.com);
  cookies de terceiros são bloqueados por vários navegadores. Mitigação: access token curto, rotação com detecção
  de reuso, sessões revogáveis, CSP-friendly Markdown (XSS) e limpeza no logout. CSRF não se aplica (sem cookies).
- **Colunas personalizáveis com categoria**: `project_columns.category ∈ {todo, doing, done}` e
  `tasks.status` = categoria da coluna. Assim dashboard, lembretes, notificações, recorrência e dependências
  continuam usando o status, enquanto o quadro usa `column_id` + `position` (`moveToColumn` em
  `packages/shared/src/domain/columns.ts`). No PATCH, `columnId` tem precedência; só `status` leva à coluna atual
  (se já for da categoria) ou à primeira coluna da categoria — o que mantém as rotas legadas compatíveis.
  Limite WIP é aviso visual (decisão: não travar o fluxo da equipe).
- **Controle de tempo**: `time_entries` com índice único parcial `(user_id) WHERE ended_at IS NULL` — o próprio
  banco impede dois cronômetros simultâneos por pessoa. Pausar = encerrar o trecho; retomar = novo trecho.
- **Hub de tempo real em memória**: suficiente para uma instância; trocar `publish*` por LISTEN/NOTIFY ao escalar.
