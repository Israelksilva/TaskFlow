# Roadmap do Andamo

Estados: **CONCLUÍDO** (implementado e verificado por testes e/ou no navegador) · **EM TESTES** (implementado,
falta verificação em ambiente real) · **EM DESENVOLVIMENTO** (parcial) · **PENDENTE** · **BLOQUEADO** (depende de
credencial/decisão externa). Requisitos completos em [REQUISITOS.md](REQUISITOS.md).

Última atualização: 25/11/2026 — branch local `saas/evolucao` (não publicada; nada foi enviado ao GitHub,
Render ou Neon).

## Situação geral

| Fase | Escopo | Estado |
|---|---|---|
| 1 | Auditoria, arquitetura, segurança, banco, Design System | CONCLUÍDO |
| 2 | Landing, autenticação, onboarding, dashboard, sidebar/header | CONCLUÍDO (Google e e-mail dependem de credenciais) |
| 3 | Workspaces, projetos, equipes, permissões, Kanban, tarefas | CONCLUÍDO (itens parciais abaixo) |
| 4 | Colaboração, notificações, lembretes, push, e-mails | CONCLUÍDO no código; entrega real de push/e-mail BLOQUEADA por credenciais |
| 5 | Calendário, tempo, documentos, relatórios, busca, automações | EM DESENVOLVIMENTO (tudo pronto, exceto Documentos/arquivos, que depende de storage) |
| 6 | Planos, pagamentos, admin, suporte | EM DESENVOLVIMENTO (planos/limites prontos; pagamentos e admin pendentes) |
| 7 | PWA, IA, integrações, otimizações, testes finais | EM DESENVOLVIMENTO (PWA e otimizações prontas) |

## Detalhamento

### R1 Design System / frontend — CONCLUÍDO
Tokens claro/escuro/automático (violeta + coral), sombras, sidebar; componentes (sheet, popover, tabs, switch,
checkbox, empty states, skeletons, toasts, tooltips, avatares); responsivo; acessível (foco visível, skip link,
ARIA, rótulos). PENDENTE: auditoria Lighthouse/axe formal.

### R2 Landing — CONCLUÍDO
Navbar, hero com a chamada oficial, demonstração (ilustração da interface), recursos, benefícios, planos,
comparação, FAQ, contato (grava em `contact_messages` + e-mail opcional), rodapé, privacidade, termos, SEO/OG.
Sem depoimentos nem números inventados. PENDENTE: revisão jurídica dos textos legais; imagem OG em PNG.

### R3 Autenticação — CONCLUÍDO
Login, cadastro, refresh token rotativo com detecção de reuso, sessões revogáveis (lista, encerrar uma/outras),
logout no servidor, bloqueio após 5 falhas (15 min) + rate limit por IP, verificação de e-mail, recuperação e
redefinição (encerra sessões), força da senha, 2FA TOTP (segredo cifrado AES-256-GCM, QR local), onboarding,
proteção de rotas. **BLOQUEADO:** login com Google precisa de `GOOGLE_CLIENT_ID` (código pronto, botão só aparece
quando configurado).

### R4 Dashboard — CONCLUÍDO
KPIs reais, série diária/semanal, próximos vencimentos, progresso de projetos, produtividade por pessoa,
atividades, atalhos, filtros (período/projeto/responsável), widgets personalizáveis (por navegador).
PENDENTE: "próximos compromissos" depende de eventos/reuniões (R13).

### R5 Sidebar e header — CONCLUÍDO (parcial por dependência)
Itens implementados: Visão geral, Caixa de entrada, Minhas tarefas, Projetos (+lista), Calendário, Equipe,
Lixeira, Ajustes, Planos, Configurações, Ajuda. Header: busca/Ctrl+K, seletor de workspace, sino com contador e
dropdown, avatar/menu, breadcrumbs, criação rápida. **PENDENTE (sem item no menu até existirem, para não criar
botões sem função):** Documentos, Controle de tempo, Relatórios, Automações, Integrações.

### R6 Workspaces — CONCLUÍDO
Múltiplos workspaces, workspace pessoal automático, alternância, nome/logo (URL), convites por e-mail (token de
uso único, 7 dias, preso ao e-mail), membros, equipes, transferência de propriedade, arquivamento (somente
leitura), histórico (`activity_log`), auditoria (`audit_log`). Isolamento: toda rota `/:workspaceId` exige
vínculo; consultas filtram `workspace_id`; testes de IDOR. PENDENTE: upload de logo (depende de R15);
Row-Level Security no PostgreSQL como defesa extra.

### R7 Projetos — CONCLUÍDO
CRUD, duplicação, templates (com cópia de tarefas/checklist/etiquetas), arquivamento, exclusão autorizada (soft
delete), cor, status, prioridade, datas, objetivo, responsável, equipe, progresso, histórico.
PENDENTE: seletor de ícone na UI (campo existe), documentos por projeto (R15).

### R8 Kanban — CONCLUÍDO (parcial)
CONCLUÍDO: **colunas personalizáveis** (criar, renomear, cor, categoria A Fazer/Em andamento/Concluído,
reordenar, excluir movendo as tarefas — nada é apagado), **limite WIP** por coluna (aviso visual; não bloqueia),
templates copiam as colunas, DnD fluido (mouse/toque/teclado) entre N colunas com rolagem horizontal e abas no
celular, ordem persistida, filtros (busca, prioridade, atrasadas, responsável, etiqueta), criação rápida na
coluna, atualização otimista com rollback, tempo real, seleção múltipla e ações em massa (lista/tabela),
visualizações Kanban, Lista (agrupável), Tabela (ordenável), Timeline/Gantt, Calendário.
Verificado no navegador em 25/11/2026 (criar coluna, mover coluna, mover tarefa pelo menu, WIP excedido).
**PENDENTE:** arrastar colunas (hoje reordena pelo menu ←/→), raias por responsável no próprio Kanban, seleção
múltipla dentro do Kanban.

### R9 Tarefas — EM DESENVOLVIMENTO
CONCLUÍDO: título, descrição rica (Markdown seguro com barra de formatação e pré-visualização), múltiplos
responsáveis, projeto (mover entre projetos), status, prioridade (inclui Urgente), início, prazo + hora,
estimativa, etiquetas, subtarefas, checklist, comentários, menções, dependências (sem ciclos), seguidores,
histórico, recorrência (diária/semanal/mensal), duplicação, arquivamento, lixeira/restauração, progresso,
detecção de conflito (`expectedUpdatedAt` → 409).
**PENDENTE:** anexos (R15), tempo trabalhado (R14), campos personalizados, templates de tarefa (há templates de
projeto).

### R10 Notificações — CONCLUÍDO no código / entrega externa BLOQUEADA
Central (sino, contador, dropdown, página, lida/não lida, todas, excluir, filtros, histórico paginado, data/hora,
link para a tarefa), tempo real (WebSocket), toasts, som opcional. Eventos: atribuição, alteração, status,
prioridade, prazo, comentário, menção, conclusão, reabertura, atraso (varredura horária), prazo próximo
(lembretes), convite, membro entrou, permissão alterada, projeto concluído, dependência desbloqueada.
Lembretes configuráveis (7d, 3d, 1d, 1h, no vencimento, 1 dia após) em fila durável no PostgreSQL.
Preferências: canais, sons, categorias, horário silencioso, não perturbe, frequência (imediato/diário/semanal),
fuso (perfil). Backend: persistência, fila com `FOR UPDATE SKIP LOCKED`, retry exponencial, idempotência
(`dedupe_key`), logs de entrega, controle de frequência de push, limpeza de inscrições expiradas.
**BLOQUEADO:** envio real de e-mail (`RESEND_API_KEY` + domínio verificado) e push (`VAPID_*`).
**PENDENTE:** eventos "anexo" (R15), "automação falhou" (R17), "aviso administrativo" (R23); preferências por
projeto na UI (campo `muted_projects` existe na API).
Decisão: Redis/BullMQ avaliados e **não adotados** — o Render free não inclui Redis e o volume atual cabe numa
fila PostgreSQL; a interface (`enqueue`/`registerJob`) permite trocar depois.

### R11 Equipes e permissões — CONCLUÍDO
RBAC com 6 papéis validado no servidor (`packages/shared/src/rbac.ts` + middlewares), hierarquia (ninguém
promove acima de si; dono só por transferência), cargo, departamento, capacidade semanal, produtividade no
dashboard. PENDENTE: convidados restritos a projetos específicos (hoje veem o workspace inteiro).

### R12 Colaboração em tempo real — CONCLUÍDO
Comentários, respostas, menções, reações, feed, presença na tarefa, atualização de tarefas/comentários em
tempo real, reconexão automática com backoff e renovação de token, conflitos de edição (409 + recarga).
Limitação documentada: hub em memória = uma instância (para escalar, LISTEN/NOTIFY ou Redis pub/sub).

### R13 Calendário — EM DESENVOLVIMENTO
CONCLUÍDO: mês, semana, dia, agenda, prazos, filtro por projeto, criar tarefa no dia, arrastar para remarcar,
exportação ICS. **PENDENTE:** eventos e reuniões (nova tabela). **BLOQUEADO:** Google Calendar (OAuth).

### R14 Controle de tempo — CONCLUÍDO
Cronômetro por tarefa (iniciar, pausar/retomar = novos trechos, parar pelo header), **um cronômetro por pessoa
garantido no banco** (índice único parcial) com opção de trocar de tarefa, registro manual, edição/exclusão
(autor ou gestor+), tempo apontado na tarefa, estimado × realizado (tarefa e relatório), horas por dia, por
projeto e por pessoa, filtros de período/projeto/pessoa, exportação CSV (compatível com Excel), atualização
entre dispositivos (WebSocket). Disponível no plano Free (decisão: `plans.ts`, ajustável).
Verificado no navegador em 25/11/2026. PENDENTE: exportação em PDF/Excel nativo (junto com R16).
### R15 Documentos e arquivos — PENDENTE (requer storage de objetos: S3/R2/Supabase — decisão e credenciais)
### R16 Relatórios — CONCLUÍDO
Dados reais com período livre (até 1 ano) e **comparação automática com o período anterior**: concluídas,
criadas, taxa de conclusão, atrasadas, tempo médio de conclusão, concluídas no prazo, horas; evolução diária ou
semanal (gráfico interativo com séries ligáveis); desempenho por projeto; produtividade e **carga × capacidade**
por pessoa; por prioridade; filtros de projeto e pessoa. Exportação: **CSV** (pt-BR), **Excel .xlsx real**
(gerado no navegador, várias abas) e **PDF** pela impressão do navegador (layout de impressão sem menu).
Verificado no navegador em 26/11/2026. Observação: o PDF usa a janela de impressão (“Salvar como PDF”); não há
geração de PDF no servidor.

### R17 Automações — CONCLUÍDO
Gatilhos (tarefa criada, concluída, status alterado, mudou de coluna, atrasada, subtarefas concluídas, projeto
concluído) → condições (prioridade, etiqueta, responsável, status/coluna de destino) → ações (notificar
responsáveis/criador/seguidores/gestores/equipe do projeto/pessoa, atribuir, prioridade, mover de coluna,
etiqueta, prazo em N dias, concluir tarefa principal). Criar, editar, ativar/pausar, excluir, histórico,
6 modelos com os exemplos do requisito. Execução pela fila (retry), idempotência por evento, **prevenção de
loops** (a automação não reage à própria cadeia; profundidade máx. 3), limite de 100 execuções/h, falha
registrada e avisada ao criador (evento “automação falhou” de R10). Recorrência continua nativa.
Verificado no navegador em 26/11/2026.
### R18 IA — PENDENTE (exige escolha de provedor e credenciais; nunca alterar dados sem confirmação)

### R19 PWA — EM TESTES
Manifest, service worker (cache de assets, navegação offline, push, clique abre a tarefa), ícones SVG, tela
offline, indicador de conexão, limpeza de dados locais e caches no logout. PENDENTE: ícones PNG 192/512 para
instalabilidade máxima, validação Lighthouse PWA, sincronização offline de edições.

### R20 Busca global — CONCLUÍDO
Tarefas, projetos, pessoas, equipes, comentários; restrita ao workspace do membro; debounce; histórico local;
atalhos. PENDENTE: paginação dos resultados e documentos (R15).

### R21 Configurações — CONCLUÍDO
Perfil, foto (URL https), senha, idioma (pt-BR), fuso, aparência, notificações, segurança, sessões, 2FA,
exportação de dados, exclusão de conta. PENDENTE: upload de foto (R15), outros idiomas, integrações.

### R22 Monetização — EM DESENVOLVIMENTO
CONCLUÍDO: planos FREE/PRO/BUSINESS configuráveis (`packages/shared/src/plans.ts`), página de preços,
comparação, limites aplicados no servidor (projetos, membros, convidados), uso no app.
**BLOQUEADO:** checkout, assinaturas, cupons, webhooks — requer escolher Stripe ou Mercado Pago e chaves de
**teste**. Nenhuma cobrança é feita; a UI informa que o pagamento online ainda não está habilitado.

### R23 Painel administrativo — PENDENTE (flag `is_platform_admin`, guard de rota e `audit_log` já existem)
### R24 Suporte — EM DESENVOLVIMENTO (FAQ, tutoriais, atalhos e contato prontos; chamados pendentes)

### R25 Banco — CONCLUÍDO
Migração 002 não destrutiva com backfill testado sobre dados existentes; FKs, CHECKs, índices parciais, soft
delete, transações, paginação por cursor. PENDENTE: procedimento de backup/restauração documentado no Neon
(ver SECURITY.md → Operação).

### R26 Backend — CONCLUÍDO (parcial)
Monólito modular (modules/*, jobs, events, realtime, middlewares), API v1 + rotas legadas, OpenAPI
(`/v1/openapi.json`, resumo), validação Zod, erros globais, logs estruturados com `X-Request-Id`,
`/health` e `/health/ready`, graceful shutdown (HTTP, WS, worker, banco). PENDENTE: OpenAPI com schemas
completos, cache.

### R27 Segurança — CONCLUÍDO (ver SECURITY.md)
### R28 Performance — CONCLUÍDO (parcial)
Code splitting por rota, shell lazy, vendor chunks (entrada ~80 kB), error boundary com recuperação de chunk
antigo, índices. PENDENTE: Lighthouse, virtualização de listas longas.

### R29 Testes — EM DESENVOLVIMENTO
126 testes (85 API, 21 shared, 20 web), incluindo relatórios, automações (exemplos do requisito, loop, falha,
permissões, limite de plano) e exportação CSV/XLSX. Base anterior — 63 API (auth, sessões, força bruta, 2FA, LGPD, isolamento, IDOR, RBAC, limites de plano, lixeira,
recorrência, conflito, dependências, dashboard, notificações, push/e-mail, lembretes, varredura de atrasos,
migração), 17 shared, 16 web (componentes, XSS do Markdown, força da senha). Verificação manual no navegador.
**PENDENTE:** E2E Playwright, testes de acessibilidade automatizados, responsividade automatizada.

### R30 Infraestrutura — EM TESTES
`.env.example` completo, `render.yaml` atualizado, Dockerfile + docker-compose (não construído localmente: Docker
indisponível nesta máquina; o CI constrói a imagem), CI com lint, typecheck, testes, build, smoke test do bundle
e build Docker. PENDENTE: deploy (aguarda autorização), Sentry, ambiente de homologação.

## Próximos passos sugeridos (próxima sessão)
1. Revisar e autorizar: `git push` da branch + deploy (as migrações 002, 003 e 004 rodam no Neon no start do
   Render — **fazer backup/branch do Neon antes**).
2. Configurar credenciais: Resend (e-mail), VAPID (push), Google OAuth.
3. Painel administrativo da plataforma (R23) e central de chamados (R24) — não dependem de terceiros.
4. E2E com Playwright (fluxos: cadastro, quadro, cronômetro, automação).
5. Escolher provedor de pagamentos (modo teste) e storage de arquivos (R15, R22).
6. Assistente de IA (R18) — depende de escolha de provedor e chave.

Decisão registrada em 26/11/2026: como ainda não há pagamento, o plano Free inclui controle de tempo, relatórios
e 3 automações (`packages/shared/src/plans.ts`). Revisar ao ativar a cobrança.
