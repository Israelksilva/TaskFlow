# Roadmap — Andamo SaaS

Entrega dos [requisitos](REQUISITOS.md) em fases incrementais, sobre a [arquitetura](ARCHITECTURE.md).

## Regras do processo

- Uma fase por vez, em branch própria (`fase-N-nome`), integrada por PR com CI verde.
- Uma fase só termina com: tarefas marcadas, critérios de aceite cumpridos, testes novos passando,
  E2E de linha de base sem regressão, CHANGELOG/ARCHITECTURE/README atualizados.
- **Ao fim de cada fase o trabalho para** e espera a autorização do Israel para seguir.
- Prioridade das tarefas: **P0** sem ela a fase não fecha · **P1** esperada na fase · **P2** pode
  passar para a fase seguinte se travar.
- Status: ⬜ não iniciada · 🟦 em andamento · ⏸ concluída, aguardando aprovação · ✅ aprovada.

## Visão geral

| Fase | Tema                                                                   | Requisitos                        | Status |
| ---- | ---------------------------------------------------------------------- | --------------------------------- | ------ |
| 0    | Análise e planejamento                                                 | §1                                | ⏸      |
| 1    | Fundação: correções, testes E2E, API v1                                | §1, §26, §27                      | ⏸      |
| 2    | Design system, AppShell e redesign das telas atuais                    | §2, §6                            | ⏸      |
| 3    | Landing page comercial, SEO e páginas legais                           | §3                                | ⏸      |
| 4    | Autenticação completa e segurança de contas                            | §4, §22 (segurança)               | ⏸      |
| 5    | Multiempresa: workspaces, membros, equipes, RBAC, projetos, onboarding | §4 (onboarding), §7, §8, §12, §26 | ⬜     |
| 6    | **Notificações** (internas, tempo real, e-mail, push, lembretes)       | §11, §22 (preferências)           | ⬜     |
| 7    | Tarefas completas e Kanban avançado (Kanban, lista, tabela)            | §9, §10                           | ⬜     |
| 8    | Colaboração em tempo real                                              | §13                               | ⬜     |
| 9    | Dashboard completo, relatórios e busca global                          | §5, §17, §21                      | ⬜     |
| 10   | Calendário, timeline/Gantt e controle de tempo                         | §9 (visões), §14, §15             | ⬜     |
| 11   | Documentos, arquivos e automações                                      | §16, §18                          | ⬜     |
| 12   | PWA instalável e offline                                               | §20                               | ⬜     |
| 13   | Planos e assinaturas, painel administrativo, suporte, LGPD             | §22, §23, §24, §25                | ⬜     |
| 14   | Assistente de IA, hardening e CD                                       | §19, §26 (backup), §27            | ⬜     |

**Por que essa ordem.** Fundação e redesign primeiro porque tudo depende deles. Contas seguras (4)
antes de multiempresa (5), porque convites exigem e-mail verificado e sessões revogáveis.
Notificações — prioridade declarada em `§11` — vêm logo depois que existem outras pessoas a
notificar (5); os eventos de recursos posteriores (comentários, anexos, automações) entram na central
conforme cada recurso chega.

---

## Fase 0 — Análise e planejamento ⏸

- [x] Analisar repositório, stack, banco, hospedagem e Git
- [x] Auditoria de segurança e bugs ([SECURITY.md](SECURITY.md))
- [x] REQUISITOS, CLAUDE, ROADMAP, ARCHITECTURE, CHANGELOG, SECURITY
- [ ] Aprovação do Israel e respostas às decisões em aberto (fim deste arquivo)

---

## Fase 1 — Fundação ⏸

**Objetivo:** base corrigida e protegida por testes, sem mudança visível para o usuário.

- [x] P0 E2E Playwright das funcionalidades atuais: cadastro, login, criar/editar/excluir, arrastar
      entre colunas e recarregar mantendo a ordem, busca e filtros, tema, celular; no CI
- [x] P0 S-01: Zod 3 → 4 (shared, API, web)
- [x] P0 S-02: React Router 6 → 7
- [x] P0 B-01: travar o usuário (não só as tarefas) ao criar/reordenar; teste de concorrência
- [x] P0 Prefixo `/v1` com aliases das rotas atuais
- [x] P1 `/health/live` e `/health/ready`; `requestId` nos logs
- [x] P1 Rate limit global (S-06, parte 1)
- [x] P1 `npm audit` no CI (bloqueia alta/crítica)
- [x] P1 Base do OpenAPI (gerado dos schemas atuais) em `/v1/docs`
- [x] P2 B-02: limpar menção a Prisma e o script `db:studio`

**Aceite:** os 58 testes atuais e os novos E2E passam; `npm audit --omit=dev` sem alta/crítica;
o front atual funciona sem nenhuma alteração.

**Resultado:** 64 testes unitários/integração (17 shared · 36 API · 11 web) + 8 cenários E2E
(desktop e celular). `npm audit`: 0 vulnerabilidades em produção; restam 3 baixas/moderadas só em
ferramentas de desenvolvimento (ver SECURITY.md). Front sem alteração de comportamento.

---

## Fase 2 — Design system, AppShell e redesign ⏸

**Objetivo:** cara de produto premium com o que já existe.

- [x] P0 Tokens centralizados (cor, tipografia, espaçamento, raio, sombra, movimento); temas claro,
      escuro e automático
- [x] P0 Componentes: botão, campo, select, modal, dropdown, tooltip, toast, skeleton, empty state,
      avatar, badge, tabs, breadcrumb, estados de carregando/sucesso/erro
- [x] P0 AppShell: sidebar recolhível e responsiva (só itens que já funcionam), header com avatar,
      menu de perfil, breadcrumbs, botão de criação rápida
- [x] P0 Login, cadastro e quadro redesenhados, mesmo comportamento
- [x] P1 Command palette (Ctrl/Cmd + K) para navegação e ações existentes
- [x] P1 Microinterações e animações com `prefers-reduced-motion`
- [x] P1 Página interna de referência do design system
- [x] P1 Auditoria WCAG 2.2 AA com axe em todas as telas

**Aceite:** E2E da Fase 1 verdes; axe sem violações; desktop, tablet e celular revisados.

**Resultado:** 19 cenários E2E (8 da Fase 1 + 5 do AppShell + 6 de acessibilidade), todos verdes;
axe sem violações WCAG 2.2 A/AA nos temas claro e escuro. Sidebar com os itens que existem hoje
(Minhas tarefas e Design system); os demais itens do §6 (busca global real, seletor de workspace,
notificações) entram nas fases que criam essas áreas.

---

## Fase 3 — Landing page comercial ⏸

**Decisão:** ADR-002 — continuar no GitHub Pages com `HashRouter` (Israel, 25/11/2026).

- [x] P0 Landing: navbar, hero com a chamada de `§3`, demonstração com screenshots reais, seções de
      funcionalidades, projetos, colaboração, notificações, produtividade, benefícios
- [x] P0 Planos com os valores de `§23` (marcados "em breve" até a Fase 13); FAQ; cadastro/login
- [x] P0 Formulário de contato salvo no banco, com anti-spam e rate limit
- [x] P0 Política de privacidade e termos de uso (rascunho para revisão jurídica)
- [x] P0 SEO, Open Graph, sitemap, robots; CSP via `<meta>` (S-07 parcial — limite do GitHub Pages)
- [x] P1 Animações de navegação (entrada das seções, respeitando `prefers-reduced-motion`)
- [x] Regra: só apresentar como disponível o que existe; nada de clientes, depoimentos ou números inventados

**Resultado:** landing em `/` e app em `/#/app`; login e cadastro com painel violeta e captura real;
26 testes E2E (inclui axe na landing, privacidade e termos, nos dois temas), 40 testes da API e
14 do front. Pendências fora do escopo: aviso por e-mail das mensagens (Fase 6), leitura das
mensagens no painel administrativo, revisão jurídica dos textos legais.

**Referências visuais (25/11/2026):** Israel enviou mockups de dashboards, Kanban e login (estilo
violeta, cards arredondados) e uma prévia da "Visão geral" do Andamo (cards de total, em andamento,
concluídas e atrasadas, produtividade semanal, progresso) com menu completo (Quadro Kanban, Meus
projetos, Minhas tarefas, Calendário, Equipe, Relatórios, Notificações, Configurações, Aparência).
Aplicadas agora na landing e no login; a Visão geral e cada item do menu entram nas fases das
funcionalidades correspondentes, sempre com dados reais.

---

## Fase 4 — Autenticação completa ⏸

**Decisões do Israel:** ADR-003 — sem domínio próprio por enquanto: refresh token no
armazenamento do navegador em vez de cookie HttpOnly (revisar quando houver domínio). ADR-004 — e-mail
construído agora e enviado depois: sem `RESEND_API_KEY`, produção não envia e as telas que dependem de
e-mail ficam ocultas. Login com Google construído e desligado até existirem as credenciais OAuth.

- [x] P0 Sessões: access de 15 min em memória + refresh rotativo com detecção de reuso; "manter
      conectado" (30 dias × 24 h); renovação automática e aviso de sessão expirada no front; sessões
      ativas e encerrar outras (S-03, parcial: cookie HttpOnly depende do domínio)
- [x] P0 `Mailer` (Resend / arquivo local em dev / desligado) + templates HTML responsivos com a marca
- [x] P0 Verificação de e-mail; recuperação e redefinição de senha (S-05)
- [x] P0 Login e recuperação não revelam contas (S-04, cadastro mantém o aviso — ver SECURITY); bloqueio
      progressivo por conta + limites por IP (S-06); bcrypt 12 com rehash (S-08)
- [x] P1 Login com Google (OAuth + PKCE; vincular/desvincular nas configurações) — desligado até as
      credenciais
- [x] P1 2FA TOTP com códigos de recuperação
- [x] P1 Força da senha, mostrar/ocultar senha
- [x] P1 Configurações: dados pessoais, senha, idioma, fuso, aparência, segurança, sessões
- [ ] P2 Foto de perfil → Fase 11 (depende do armazenamento de arquivos, ADR-005)

**Para ligar em produção (Israel):** `RESEND_API_KEY` + `MAIL_FROM` (e-mail) e `GOOGLE_CLIENT_ID` +
`GOOGLE_CLIENT_SECRET` (Google), além de `APP_URL`, `API_PUBLIC_URL` e `DATA_ENCRYPTION_KEY` — passo a
passo no README.

---

## Fase 5 — Multiempresa, equipes, permissões e projetos

**Atenção:** migração de dados dos usuários atuais — rodar antes em cópia do banco, com backup.

- [ ] P0 Workspaces (criar, alternar, nome/logo/cores, arquivar, transferir propriedade)
- [ ] P0 Migração não destrutiva dos dados atuais (workspace pessoal + "Meu quadro")
- [ ] P0 Middleware de inquilino e matriz RBAC dos 6 cargos; testes de acesso cruzado em todas as rotas
- [ ] P0 Convites por e-mail; gerenciamento de membros e cargos
- [ ] P0 Projetos: criar, editar, duplicar, arquivar, excluir; todos os campos de `§8`
- [ ] P0 Colunas personalizáveis (criar, renomear, cor, ordem, limite WIP, excluir com destino)
- [ ] P0 Outbox de eventos + `activity_log` + `audit_log` (histórico de atividades)
- [ ] P1 Equipes e departamentos; projetos restritos a equipes; convidado só vê o compartilhado
- [ ] P1 Templates dos 7 tipos de projeto de `§8`
- [ ] P1 Onboarding do primeiro acesso: perfil → workspace → convites → primeiro projeto
- [ ] P1 Seletor de workspace no header; "Meus projetos"; "Minhas tarefas"

**Aceite:** usuário existente encontra todas as tarefas na mesma ordem; nenhum endpoint vaza dados
entre workspaces, nem manipulando requisições (testado).

---

## Fase 6 — Notificações (prioridade)

**Decisão necessária:** ADR-008 (API sempre ligada — custo mensal).

- [ ] P0 Infra: pg-boss (filas, cron, retry, idempotência), worker, `delivery_log`
- [ ] P0 Socket.IO autenticado, salas por workspace/usuário, reconexão
- [ ] P0 Central: sino com contador, dropdown, página completa, lida/todas lidas, excluir, filtros por
      categoria, agrupamento, link para o conteúdo, tempo real, som opcional
- [ ] P0 Eventos disponíveis até aqui: atribuição, mudança de responsável/status/prioridade/prazo,
      concluída, reaberta, atrasada, prazo próximo, convites, novo membro, permissões, projeto concluído,
      avisos administrativos
- [ ] P0 Lembretes configuráveis (7d, 3d, 1d, 1h, no vencimento, após, personalizado) por job
      persistido
- [ ] P0 E-mails: atribuição, lembretes, atrasos, convites; resumos diário e semanal
- [ ] P0 Preferências: por canal, categoria, frequência, horário silencioso, não perturbe, sons, fuso,
      por projeto
- [ ] P1 Web Push com VAPID e service worker; pedido de permissão; clique abre o conteúdo;
      remoção de inscrições expiradas
- [ ] P1 Controle de frequência, prevenção de duplicadas, monitoramento de falhas

**Aceite:** nenhuma notificação duplicada em reprocessamento (testado); lembrete dispara mesmo após
reinício do servidor.

---

## Fase 7 — Tarefas completas e Kanban avançado

- [ ] P0 Campos de `§10`: texto rico, criador, múltiplos responsáveis, datas, estimativa, etiquetas,
      subtarefas, checklists, dependências, seguidores, campos personalizados, percentual de conclusão
- [ ] P0 Arquivar, lixeira, restaurar; duplicar; templates; tarefas recorrentes
- [ ] P0 Kanban: filtros avançados, agrupar por prioridade/responsável/etiqueta, criação rápida,
      seleção múltipla, edição em massa, cores por status, limites por coluna
- [ ] P0 Visualizações lista e tabela
- [ ] P1 Compartilhamento de tarefa com controle de acesso
- [ ] P1 Notificações dos novos eventos (dependência desbloqueada, anexos quando houver)

---

## Fase 8 — Colaboração em tempo real

- [ ] P0 Comentários com respostas, menções com @, reações, edição/exclusão autorizadas
- [ ] P0 Atualização em tempo real de tarefas e comentários; sincronização entre dispositivos
- [ ] P0 Conflitos de edição com `version` (409 + resolução na interface)
- [ ] P1 Usuários online; feed de atividades
- [ ] P1 Notificações e e-mails de comentário e menção

---

## Fase 9 — Dashboard, relatórios e busca

- [ ] P0 Dashboard com todos os indicadores de `§5`, dados reais, filtros (período, projeto,
      responsável), gráficos interativos, atividades recentes, minhas tarefas do dia, criação rápida
- [ ] P1 Widgets personalizáveis
- [ ] P0 Relatórios de `§17` com comparação entre períodos; exportação PDF, CSV e Excel
- [ ] P0 Busca global (tarefas, projetos, usuários, equipes, comentários; documentos na Fase 11) com
      permissões, debounce, paginação, filtros, histórico e command palette

---

## Fase 10 — Calendário, timeline/Gantt e controle de tempo

- [ ] P0 Calendário mês/semana/dia/agenda; eventos e reuniões; prazos e lembretes; filtros; criar pelo
      calendário; arrastar datas; exportação ICS
- [ ] P1 Integração com Google Calendar (credenciais do Israel)
- [ ] P0 Visões timeline e Gantt (com dependências)
- [ ] P0 Time tracking: cronômetro (iniciar/pausar/finalizar), registro manual, histórico, estimado ×
      realizado, horas por projeto/usuário, relatório e exportação, um cronômetro ativo por usuário

---

## Fase 11 — Documentos, arquivos e automações

**Decisão necessária:** ADR-005 (armazenamento — conta R2 ou equivalente).

- [ ] P0 Upload validado, download por URL assinada, pastas por projeto, pré-visualização, busca,
      permissões, limites por plano; anexos em tarefas
- [ ] P0 Documentos internos com editor rico
- [ ] P0 Automações: gatilho → condições → ações; criar/editar/ativar; histórico e erros;
      proteção contra loops; limite por plano; os 7 exemplos de `§18`
- [ ] P1 Notificações de arquivo anexado e falha em automação

---

## Fase 12 — PWA

- [ ] P0 Manifest, ícones, splash, instalação em desktop e celular
- [ ] P0 Cache estratégico, tela offline, indicador de conexão
- [ ] P1 Fila de operações offline com sincronização e tratamento de conflitos
- [ ] P0 Limpeza de dados locais sensíveis no logout

---

## Fase 13 — Comercialização, administração e suporte

**Decisão necessária:** ADR-006 (gateway). **Cobrança real só com autorização.**

- [ ] P0 Planos configuráveis (Free, Pro, Business de `§23`) e limites validados no backend
- [ ] P0 Checkout, recorrência, upgrade, downgrade, cancelamento, teste grátis, histórico, cupons,
      webhooks assinados e idempotentes — em modo de teste
- [ ] P0 Painel administrativo do SaaS com todos os indicadores de `§24`, 2FA obrigatório, auditoria
- [ ] P0 Central de ajuda: FAQ, base de conhecimento, tutoriais, chamados com histórico e respostas,
      sugestões e bugs
- [ ] P0 LGPD: exportação de dados pessoais e exclusão de conta
- [ ] P1 Integrações na tela de configurações

---

## Fase 14 — IA, hardening e entrega contínua

- [ ] P1 Assistente de IA opcional (`§19`) atrás de `AiProvider`; sugestões sempre confirmadas pelo
      usuário; limites por plano
- [ ] P0 RLS como defesa em profundidade; revisão de segurança completa
- [ ] P0 Backup diário e teste de restauração documentado
- [ ] P0 CD para produção após CI verde; monitoramento de erros e status dos serviços

---

## Decisões em aberto

| #   | Pergunta                                                           | Bloqueia           | Recomendação                         |
| --- | ------------------------------------------------------------------ | ------------------ | ------------------------------------ |
| 1   | Restante do documento de requisitos (o texto parou no meio do §27) | Planejamento final | Enviar o restante                    |
| 2   | Hospedagem do front (ADR-002)                                      | Fase 3             | ✅ GitHub Pages + `HashRouter`        |
| 3   | Domínio próprio (ADR-003)                                          | Fase 4             | ✅ Adiado: sem domínio por enquanto   |
| 4   | Conta no Resend e domínio de envio (ADR-004)                       | Fase 4             | ✅ Construído; envio quando houver chave |
| 5   | API sempre ligada (ADR-008) — custo mensal                         | Fase 6             | Render Starter ou equivalente        |
| 6   | Armazenamento de arquivos (ADR-005)                                | Fase 11            | Cloudflare R2                        |
| 7   | Gateway: Stripe ou Mercado Pago (ADR-006)                          | Fase 13            | Mercado Pago (PIX/boleto)            |
| 8   | Provedor de IA (ADR-011)                                           | Fase 14            | Decidir na fase                      |
