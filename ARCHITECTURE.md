# Arquitetura — Andamo

Como o Andamo é hoje e como ele evolui para SaaS multiempresa. Requisitos em
[REQUISITOS.md](REQUISITOS.md) (citados como `§N`); entregas em [ROADMAP.md](ROADMAP.md); segurança em
[SECURITY.md](SECURITY.md). Ao concluir cada fase, atualize "Estado atual" e a tabela de ADRs.

---

## 1. Estado atual (linha de base: `main` em `7bf1d41`, 24/11/2026)

**Repositório e Git.** Monorepo npm workspaces; branches `main` (código) e `gh-pages` (front publicado).
Árvore limpa, sem tags nem releases. CI no GitHub Actions (lint → typecheck → test → build); não há CD.
Verificado nesta análise: lint ✓, typecheck ✓, **58 testes ✓** (shared 17, API 30, web 11).

```
apps/api        Express 5 · TypeScript · Zod 3 · pg (SQL parametrizado) · JWT · pino · helmet
apps/web        React 18 · Vite 5 · Tailwind 3 · shadcn/ui · React Query 5 · dnd-kit · React Router 6 (Hash)
packages/shared schemas Zod, DTOs e regras do quadro (moveTask, diffOrder, estatísticas)
```

**API** — `routes → controller → service → repository`.

- `db/database.ts`: interface `Database` (`query`, `transaction`) com `pg.Pool` (Neon) e PGlite
  (Postgres WASM para testes e dev sem Neon).
- `db/migrate.ts`: migrador próprio; `migrations/NNN_*.sql` em ordem, cada um em transação,
  registrado em `schema_migrations`. Hoje há só `001_create_users_and_tasks.sql`.
- Auth: `/auth/cadastro`, `/auth/login`, `/auth/me`; JWT HS256 de 7 dias; bcrypt; rate limit
  20/15 min por IP só nessas rotas.
- Tarefas: `/tarefas` (CRUD + `/importar`), isoladas por `user_id`. Reordenação em transação com
  `FOR UPDATE`; o shared calcula a nova ordem e grava só o que mudou.
- Erros padronizados `{ error: { code, message, details? } }`; SQLSTATE mapeados para 4xx.
- Health check `GET /health` (consulta o banco).

**Banco** — `users`, `tasks` (status fixo `todo/doing/done`, `position` por coluna, `due_date`,
`completed_at`), índice `(user_id, status, position)`.

**Web** — rotas `#/` (quadro), `#/entrar`, `#/cadastro`. Token no `localStorage`. Quadro com
atualização otimista, rollback, DnD acessível, filtros, atalhos, tema claro/escuro/sistema
(`next-themes`), responsivo, importação do `localStorage` antigo.

**Hospedagem** — Banco: Neon. API: Render (`render.yaml`, plano free, migra no start). Front:
GitHub Pages em `/TaskFlow/` (por isso `HashRouter` e `base` no Vite). O plano free do Render
**hiberna após inatividade**, o que inviabiliza lembretes agendados e WebSocket estável (ADR-008).

**Problemas encontrados** — auditoria em [SECURITY.md](SECURITY.md) (S-01 a S-08, B-01, B-02).

---

## 2. Princípios

1. **Preservar o que funciona.** Migrações novas (nunca editar antigas), migração de dados testada,
   rotas antigas mantidas como alias até serem aposentadas no ROADMAP. Os E2E de linha de base
   protegem as funcionalidades atuais a partir da Fase 1.
2. **Isolamento multiempresa no backend, sempre** (`§7`). Nenhum repositório acessa dados de negócio
   sem `workspace_id`; permissão checada antes do service; 404 para recurso de outro workspace;
   testes de acesso cruzado em toda rota.
3. **Contrato único em `packages/shared`:** schemas Zod → validação da API, formulários do front,
   OpenAPI e matriz de permissões.
4. **Provedores externos atrás de interfaces** (e-mail, push, storage, pagamento, OAuth, IA, agenda),
   com implementação fake para dev/teste. Testes nunca acessam a rede.
5. **Efeitos colaterais por eventos.** O service grava os dados e um evento de domínio na mesma
   transação (outbox); workers consomem e disparam notificações, e-mails, push, automações e
   tempo real. Nada importante depende de timer em memória (`§11`).
6. **Fatias verticais:** migração + API + UI + testes juntos em cada funcionalidade.
7. **Sem dados fictícios em produção** (`§3`, `§5`). Seed de demonstração só em dev.

---

## 3. Visão geral alvo

```
            ┌──────────── Navegador / PWA ─────────────┐
            │ React SPA · Service Worker (cache, push)  │
            └──────┬───────────────┬────────────────────┘
              HTTPS REST /v1    Socket.IO (wss)
            ┌──────▼───────────────▼────────────────────┐
            │ API (Express)                              │──► Resend (e-mail)
            │ auth · tenants · projetos · tarefas · …    │──► Web Push (VAPID)
            │ grava dados + outbox na mesma transação    │──► R2/S3 (arquivos, URL assinada)
            └──────┬─────────────────────────────────────┘──► Stripe ou Mercado Pago
                   │                                       ──► Google (OAuth, Calendar)
            ┌──────▼─────────┐    ┌──────────────────────┐──► Provedor de IA (opcional)
            │ PostgreSQL     │◄───┤ Worker (pg-boss)     │
            │ (Neon)         │    │ filas, cron, retry,  │
            │ dados + filas  │    │ lembretes, resumos   │
            └────────────────┘    └──────────────────────┘
```

- **Filas e jobs (ADR-009):** pg-boss sobre o próprio Postgres — retry com backoff, agendamento,
  cron, `singletonKey` para idempotência, sem infraestrutura nova. Redis + BullMQ fica como evolução
  se o volume exigir; a interface `JobQueue` isola a escolha.
- **Tempo real:** Socket.IO no processo da API, salas por workspace/projeto/tarefa; eventos emitidos
  após o COMMIT a partir do outbox. Uma instância dispensa Redis; com mais de uma, adaptador Redis.
- **Worker:** mesmo código da API, outro entrypoint (`dist/worker.js`); começa no mesmo serviço e
  pode ser separado depois.

---

## 4. Multiempresa e permissões

**Modelo de inquilino (ADR-001):** um nível só — o **workspace** é a organização (nome, logo, cores,
plano, membros). Cada usuário ganha um workspace pessoal; empresas criam workspaces de equipe e o
usuário alterna entre eles. Dentro do workspace há **equipes** (`§12`) e **projetos** (`§8`). É o modelo
do Linear e do Slack: simples de isolar, cobrar e entender. "Organização" é o nome exibido para
workspaces de equipe.

**Cargos (`§12`):** `owner` (proprietário) · `admin` · `manager` (gestor) · `member` · `guest`
(convidado: só projetos compartilhados com ele) · `viewer`. A matriz `ação × cargo` vive em
`packages/shared` (`permissions.ts`); a API aplica (`requirePermission('task.update')`) e o front usa a
mesma matriz só para esconder ações. Projetos podem restringir acesso a membros ou equipes.

**Pipeline de rota protegida:**
`rateLimit → authenticate → resolveWorkspace(:ws) → loadMembership → requirePermission(ação)
→ validate(zod) → controller → service(ctx) → repository(ctx.workspaceId, …)`,
com `ctx = { userId, workspaceId, role, requestId }`.

**Defesa em profundidade (Fase 14):** RLS do Postgres com `SET LOCAL app.workspace_id` por transação.

---

## 5. Modelo de dados alvo (`§26`)

Convenções: PK `uuid`; `created_at/updated_at`; FKs com `ON DELETE` explícito; `workspace_id` em toda
tabela de negócio, com índices começando por ele; soft delete (`deleted_at`) onde há lixeira ou
restauração; `version int` para concorrência otimista; paginação por cursor (`created_at, id`).

| Domínio                 | Tabelas                                                                                                                                                                                                                                                                                                                                                                                | Fase |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Contato                 | `contact_messages` (formulário da landing)                                                                                                                                                                                                                                                                                                                                             | 3    |
| Identidade              | `users` (+ avatar, locale, timezone, `email_verified_at`, `is_platform_admin`), `sessions`, `email_tokens`, `auth_identities` (Google), `mfa_factors`, `mfa_recovery_codes`, `login_attempts`                                                                                                                                                                                          | 4    |
| Inquilino               | `workspaces` (nome, slug, logo, cores, tipo, plano, `archived_at`), `workspace_members` (cargo), `invitations`, `teams`, `team_members`, `departments`                                                                                                                                                                                                                                 | 5    |
| Projetos                | `projects` (ícone, cor, responsável, equipe, datas, status, prioridade, objetivos, configurações jsonb, `archived_at`, `deleted_at`), `project_members`, `project_templates`                                                                                                                                                                                                           | 5    |
| Quadro                  | `board_columns` (projeto, nome, cor, posição, **categoria** `todo/doing/done`, limite WIP)                                                                                                                                                                                                                                                                                             | 5    |
| Eventos e auditoria     | `outbox_events`, `activity_log` (feed e histórico), `audit_log` (ações administrativas e de segurança)                                                                                                                                                                                                                                                                                 | 5    |
| Notificações            | `notifications`, `notification_preferences`, `push_subscriptions`, `reminders`, `delivery_log` (canal, status, tentativas, chave de idempotência)                                                                                                                                                                                                                                      | 6    |
| Tarefas                 | `tasks` (+ `workspace_id`, `project_id`, `column_id`, `created_by`, `start_date`, `estimate_minutes`, `description_json`, `parent_id` p/ subtarefa, `recurrence`, `archived_at`, `deleted_at`, `version`), `task_assignees`, `task_followers`, `task_dependencies`, `checklists`, `checklist_items`, `labels`, `task_labels`, `custom_fields`, `custom_field_values`, `task_templates` | 7    |
| Colaboração             | `comments` (respostas por `parent_id`), `comment_mentions`, `reactions`                                                                                                                                                                                                                                                                                                                | 8    |
| Calendário e tempo      | `events`, `event_attendees`, `time_entries` (índice parcial: um cronômetro ativo por usuário), `integrations` (tokens **criptografados**)                                                                                                                                                                                                                                              | 10   |
| Documentos e automações | `folders`, `documents`, `files` (chave no storage, mime, tamanho, hash), `automations` (gatilho, condições, ações), `automation_runs` (status, erro, profundidade)                                                                                                                                                                                                                     | 11   |
| Comercial e suporte     | `plans` (preços e limites configuráveis), `subscriptions`, `payments`, `coupons`, `webhook_events`, `support_tickets`, `ticket_messages`, `announcements`                                                                                                                                                                                                                              | 13   |

**Colunas personalizáveis (`§9`) sem quebrar as regras atuais:** cada coluna tem uma _categoria_
(`todo/doing/done`). A tarefa passa a pertencer a uma coluna; conclusão, `completed_at`, estatísticas
e o legado `/tarefas` continuam usando a categoria. Na migração, cada projeto recebe as três colunas
atuais.

**Migração dos dados existentes (Fase 5):** por usuário → workspace pessoal (ele como `owner`) →
projeto "Meu quadro" com as 3 colunas → tarefas recebem `workspace_id`, `project_id`, `column_id`,
`created_by`, na mesma ordem. Não destrutiva: `user_id` e `status` antigos ficam até uma limpeza
autorizada.

**Busca global (`§21`):** full-text do PostgreSQL (`tsvector` + `unaccent`) e `pg_trgm` para sugestões,
sempre filtrada por workspace e permissões. Sem serviço externo.

**Backup e restauração:** PITR do Neon (conforme o plano contratado) + `pg_dump` diário via GitHub
Actions para armazenamento privado criptografado; teste de restauração mensal documentado.

---

## 6. API

- **Versionamento (`§27`):** prefixo `/v1`. As rotas atuais (`/auth`, `/tarefas`) continuam como alias
  até serem aposentadas com aviso no CHANGELOG.
- **Recursos** em português, como hoje: `/v1/workspaces/:ws/projetos/:p/tarefas`, `…/colunas`,
  `/v1/workspaces/:ws/membros`, `…/convites`, `…/equipes`, `…/notificacoes`, `…/busca`,
  `…/relatorios`, `…/automacoes`, `…/documentos`, `/v1/conta/*`, `/v1/admin/*`, `/v1/webhooks/*`.
- **Listas:** paginação por cursor (`?limite=&cursor=`); filtros e ordenação validados.
- **Concorrência:** PATCH aceita `version`; versão desatualizada → `409 CONFLICT` com o estado atual,
  usado pelo front para resolver o conflito (`§13`).
- **OpenAPI:** gerado dos schemas Zod; Swagger UI em `/v1/docs`.
- **Observabilidade:** pino com `requestId`; `/health/live` e `/health/ready` (banco e fila).

**Sessões (Fase 4):** access JWT de 15 min no corpo da resposta (memória do front); refresh opaco em
cookie `HttpOnly; Secure; SameSite`, rotacionado a cada uso, com revogação da família em caso de reuso;
"manter conectado" = refresh de 30 dias, senão de sessão. 2FA TOTP com códigos de recuperação.

---

## 7. Front-end

```
src/
  app/              providers, roteador, guards, AppShell (sidebar recolhível + header)
  design-system/    tokens (cor, tipografia, espaçamento, raio, sombra, movimento) e temas
  components/ui     shadcn (base existente) + componentes do Andamo
  pages/public/     landing, planos, termos, privacidade, contato, ajuda
  features/         auth · onboarding · dashboard · workspaces · projects · board · tasks ·
                    notifications · calendar · time · documents · reports · automations ·
                    search · settings · billing · admin · support · ai
  sw/               service worker (cache, push, offline)
```

- **Design system (`§2`):** os tokens CSS (HSL) que já existem viram a única fonte de cor, tipografia e
  movimento, com página interna de referência. Violeta/coral como base; Plus Jakarta Sans + Inter;
  ícones Lucide; WCAG 2.2 AA (contraste, foco visível, alvos ≥ 24 px, teclado).
- **Roteamento:** `/app/:ws/...`; tipo de roteador conforme ADR-002.
- **Estado do servidor:** React Query com chaves por workspace; eventos do Socket.IO atualizam o cache.
- **Quadro:** componentes e mutações otimistas atuais reaproveitados; viram uma das visões do projeto
  (Kanban, lista, tabela, calendário, timeline, Gantt).
- **Texto rico:** TipTap (JSON salvo + HTML sanitizado no servidor). **Gráficos:** Recharts.
  **Command palette:** cmdk.
- **PWA:** `vite-plugin-pwa` (Workbox) — manifest, cache, tela offline, push; fila local de operações
  pendentes, limpa no logout.

---

## 8. Qualidade

| Camada    | Ferramenta                     | Cobertura mínima                                                              |
| --------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Domínio   | Vitest                         | regras puras: ordem, permissões, limites de plano, recorrência, estatísticas  |
| API       | Vitest + Supertest + PGlite    | sucesso, 422, 401, 403 por cargo, 404 entre workspaces, idempotência          |
| Migrações | Vitest + PGlite                | dados no esquema anterior → migrar → dados preservados                        |
| Jobs      | Vitest com fila em memória     | retry, idempotência, sem duplicatas                                           |
| Web       | Vitest + Testing Library + axe | componentes, formulários, acessibilidade                                      |
| E2E       | Playwright                     | jornadas principais em desktop e celular                                      |
| CI        | GitHub Actions                 | lint · typecheck · testes · build · E2E · `npm audit` (alta/crítica bloqueia) |
| CD        | GitHub Actions                 | deploy após CI verde na `main` (Fase 14)                                      |

---

## 9. Decisões (ADR)

| #       | Decisão                                                                                                                                | Status                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| ADR-001 | Um nível de inquilino: workspace = organização; equipes e projetos dentro dele.                                                        | Proposta                                                     |
| ADR-002 | Front fora do GitHub Pages (Cloudflare Pages ou Vercel) com `BrowserRouter`, para SEO/Open Graph por página e cabeçalhos de segurança. | **Aguardando decisão** (bloqueia a Fase 3)                   |
| ADR-003 | Domínio próprio com `app.` e `api.` no mesmo site (cookies `SameSite=Lax`).                                                            | Aguardando domínio (bloqueia a Fase 4)                       |
| ADR-004 | E-mail transacional: Resend, atrás da interface `Mailer`; templates em React Email.                                                    | Proposta (`§11` prefere Resend)                              |
| ADR-005 | Arquivos: Cloudflare R2 (compatível com S3) com URL assinada.                                                                          | Proposta                                                     |
| ADR-006 | Pagamentos: Stripe ou Mercado Pago atrás de `BillingProvider`, só em modo de teste até autorização.                                    | **Aguardando decisão** (Fase 13)                             |
| ADR-007 | Manter SQL puro + migrador próprio (sem ORM).                                                                                          | Proposta                                                     |
| ADR-008 | API sempre ligada (sair do plano free do Render ou equivalente) antes de lembretes, push e tempo real.                                 | **Aguardando decisão** (bloqueia a Fase 6; tem custo mensal) |
| ADR-009 | Filas com pg-boss no Postgres; Redis/BullMQ só se o volume exigir.                                                                     | Proposta                                                     |
| ADR-010 | Zod 4 e React Router 7 (corrigem S-01 e S-02).                                                                                         | Proposta (Fase 1)                                            |
| ADR-011 | IA atrás de `AiProvider`, chaves só no backend; toda alteração sugerida pela IA exige confirmação.                                     | Proposta (Fase 14)                                           |
