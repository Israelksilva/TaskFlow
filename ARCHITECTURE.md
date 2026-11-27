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

### 1.1 Mudanças da Fase 1

- **Rotas:** `apps/api/src/app.ts` monta o mesmo roteador em `/v1` e na raiz (aliases). Novas
  rotas entram só em `/v1`; os aliases saem quando o front migrar (Fase 2).
- **Saúde:** `modules/health` — `/health/live` (processo), `/health/ready` (banco), `/health`
  (legado do Render).
- **Observabilidade:** `X-Request-Id` gerado ou reaproveitado (`[\w-]{8,64}`) e `requestId` em cada
  linha de log do `pino-http`.
- **Proteção:** `middlewares/rate-limit.ts` (global por IP, em memória) antes do parser de JSON.
- **Contrato:** `docs/openapi.ts` gera OpenAPI 3.1 a partir dos schemas Zod compartilhados
  (`z.toJSONSchema`), servido em `/v1/openapi.json` e `/v1/docs`.
- **Concorrência:** escritas que calculam posição travam `users` (`SELECT … FOR UPDATE`).
- **Testes:** `e2e/` com Playwright; `playwright.config.ts` sobe API (PGlite em memória) e front.

### 1.2 Mudanças da Fase 2

- **Tokens:** `apps/web/src/index.css` concentra cor, sidebar, sombra (`--shadow-xs…lg`) e movimento
  (`--duration-*`, `--ease-*`); `tailwind.config.ts` os expõe (`shadow-md`, `duration-fast`,
  `ease-out`, `bg-sidebar`…). Contraste revisado para AA nos dois temas.
- **AppShell:** `components/layout/AppShell.tsx` é rota de layout das páginas logadas — sidebar
  recolhível (preferência em `localStorage`), gaveta no celular (`ui/sheet`), header com breadcrumbs,
  busca/paleta, criação rápida, indicador de salvamento e menu de conta.
- **Command palette:** `CommandPalette.tsx` (cmdk). Lê as tarefas do cache do React Query (sem
  requisição) e aciona o quadro por query string (`?nova`, `?buscar`, `?editar=<id>`), o que também
  permite criação rápida a partir de qualquer página.
- **Componentes novos:** `tabs`, `breadcrumb`, `empty-state`, `status-message`, `sheet`, `command`;
  variantes `brand` em `Button` e `brand/coral/success/warning` em `Badge`.
- **Referência:** `/#/design-system` (página interna).
- **Acessibilidade:** `e2e/a11y.spec.ts` roda axe (WCAG 2.2 A/AA) em login, cadastro, quadro, modal,
  paleta e design system, nos temas claro e escuro.

### 1.3 Mudanças da Fase 3

- **Rotas:** landing pública em `/`; app movido para `/app` (`/app/design-system`); `/design-system`
  redireciona. `GuestOnly` devolve o usuário à rota protegida de origem após o login.
- **Landing** (`pages/public/`): `PublicLayout` (navbar, menu no celular, rodapé), `LandingPage`
  (hero, funcionalidades, demonstração com capturas reais, pilares com selo Disponível/Em
  desenvolvimento, benefícios, planos do `§23` "em breve", FAQ, contato), `LegalPage` (privacidade e
  termos, rascunhos). Navegação por seção com botões + `scrollIntoView` (o `#` pertence ao roteador).
- **Capturas:** `public/screens/*.webp` geradas do sistema real com tarefas de exemplo de uma conta de
  desenvolvimento; `public/og-image.png` (1200×630).
- **Contato:** migração aditiva `002_create_contact_messages.sql`; `POST /v1/contato` com
  `contactSchema` (shared), campo-isca, tempo mínimo de preenchimento (3 s) e limite por IP
  (`CONTACT_LIMIT_PER_HOUR`, padrão 5). Envio de e-mail de aviso fica para a Fase 6; leitura das
  mensagens, para o painel administrativo.
- **SEO e segurança no build:** plugin `siteMeta` no `vite.config.ts` injeta a CSP (só no build),
  substitui `%SITE_URL%` (`VITE_SITE_URL`) e gera `sitemap.xml` e `robots.txt`. Open Graph, Twitter
  Card e JSON-LD no `index.html`. Fontes Inter e Plus Jakarta Sans servidas pelo próprio site
  (`@fontsource`), sem Google Fonts.
- **Login/cadastro:** painel violeta dividido com a captura real do quadro (referências visuais
  enviadas pelo Israel em 25/11/2026).
- **Limites configuráveis:** `AUTH_LIMIT_PER_15MIN` (padrão 20) e `CONTACT_LIMIT_PER_HOUR`; o E2E
  usa valores altos.

### 1.4 Mudanças da Fase 4

- **Migração aditiva `003_auth_sessions_security.sql`:** colunas novas em `users` (verificação de
  e-mail, 2FA, Google, idioma, fuso; `password_hash` passa a aceitar nulo para contas só Google) e
  tabelas `sessions`, `auth_tokens` (verificação, redefinição, desafio de 2FA, estado e troca do
  OAuth), `recovery_codes` e `login_throttle`. Nenhum dado existente é alterado.
- **Sessões (ADR-003):** token de acesso JWT de 15 min com `sid`; o middleware confere se a sessão
  está ativa no banco (encerrar uma sessão vale na hora). Refresh token opaco (só o hash no banco),
  trocado a cada renovação; reapresentar o anterior em até 30 s é tratado como corrida entre abas
  (`SESSION_ROTATED`), depois disso derruba a sessão. Sessão de 24 h, ou 30 dias renovados com o uso
  com "manter conectado".
- **Front:** token de acesso só em memória, refresh no `localStorage` (`lib/session.ts`).
  `api-client` renova antes de vencer e uma vez após `401`, com uma renovação por vez por aba e entre
  abas (Web Locks); recusa → sessão encerrada com aviso. Sair numa aba sai nas outras (evento
  `storage`).
- **Contas (`modules/auth`, `account`, `google`, `mail`):** verificação de e-mail (24 h), redefinição
  de senha (30 min, encerra todas as sessões), bloqueio progressivo por conta (5ª falha: 1, 2, 4… até
  30 min), 2FA TOTP (chave cifrada com AES-256-GCM, anti-reuso do código, 10 códigos de recuperação em
  hash), Google OAuth com PKCE e código de troca de 60 s (não vincula sozinho conta com e-mail não
  verificado), avisos por e-mail de troca de senha e 2FA.
- **E-mail (ADR-004):** interface `Mailer` com `ResendMailer`, `DevMailer` (grava em `.data/mails`),
  `MemoryMailer` (testes) e `DisabledMailer` (produção sem chave). `GET /v1/auth/config` diz ao front
  o que está ligado; sem e-mail, "esqueci a senha" orienta a usar o contato.
- **Telas:** login com 2FA, Google e "manter conectado"; cadastro com força da senha; esqueci/redefinir
  senha; verificar e-mail; retorno do Google; `/app/configuracoes` (perfil, aparência, senha, 2FA com
  QR code gerado no navegador, e-mail, Google, sessões); aviso de e-mail não verificado no AppShell.
- **Variáveis novas:** `ACCESS_TOKEN_TTL_MIN`, `APP_URL`, `API_PUBLIC_URL`, `DATA_ENCRYPTION_KEY`,
  `RESEND_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Sai `JWT_EXPIRES_IN`.
- **Efeito na implantação:** quem estava logado antes da atualização precisa entrar de novo uma vez
  (tokens antigos não têm sessão).

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
- **Roteamento:** `HashRouter` (ADR-002): landing em `/`, app em `/#/app/...` (multiempresa: `/#/app/:ws/...`).
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
| ADR-002 | Front continua no GitHub Pages com `HashRouter` (decisão do Israel, 25/11/2026). CSP via `<meta>`; só a raiz é indexável; sem HSTS/headers HTTP próprios. Reavaliar junto com o domínio (ADR-003). | **Aceito** — limitações em SECURITY S-07 |
| ADR-003 | Sem domínio próprio por enquanto (decisão do Israel na Fase 4): refresh token no `localStorage`, access token só em memória, sessões revogáveis no servidor. Com domínio: refresh em cookie HttpOnly `SameSite=Lax` em `api.` do mesmo site. | **Aceito** (provisório) — risco em SECURITY S-03 |
| ADR-004 | E-mail: Resend atrás de `Mailer`; templates em TypeScript (HTML em tabelas + texto) em vez de React Email, para não trazer React à API. Sem chave, produção não envia (decisão do Israel na Fase 4: "construir já, enviar depois"). | **Aceito** — envio aguarda conta no Resend |
| ADR-005 | Arquivos: Cloudflare R2 (compatível com S3) com URL assinada.                                                                          | Proposta                                                     |
| ADR-006 | Pagamentos: Stripe ou Mercado Pago atrás de `BillingProvider`, só em modo de teste até autorização.                                    | **Aguardando decisão** (Fase 13)                             |
| ADR-007 | Manter SQL puro + migrador próprio (sem ORM).                                                                                          | Proposta                                                     |
| ADR-008 | API sempre ligada (sair do plano free do Render ou equivalente) antes de lembretes, push e tempo real.                                 | **Aguardando decisão** (bloqueia a Fase 6; tem custo mensal) |
| ADR-009 | Filas com pg-boss no Postgres; Redis/BullMQ só se o volume exigir.                                                                     | Proposta                                                     |
| ADR-010 | Zod 4 e React Router 7 (corrigem S-01 e S-02).                                                                                         | Proposta (Fase 1)                                            |
| ADR-011 | IA atrás de `AiProvider`, chaves só no backend; toda alteração sugerida pela IA exige confirmação.                                     | Proposta (Fase 14)                                           |
