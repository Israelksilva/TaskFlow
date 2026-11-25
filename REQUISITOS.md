# Requisitos do Andamo (SaaS)

Fonte: briefing do proprietário do produto (25/11/2026). Este arquivo é a referência de escopo; o estado
de cada item fica no [ROADMAP.md](ROADMAP.md). Códigos (`R1.x`) são usados no roadmap e nos commits.

Princípios obrigatórios: preservar o que já funciona e os dados existentes; não criar botões sem função nem
telas desconectadas do backend; não usar dados fictícios em produção; não simular integrações externas;
não expor credenciais; TypeScript estrito; Clean Code/SOLID/DRY; commits locais por funcionalidade;
lint + typecheck + testes + build a cada etapa; nada de push, deploy, cobrança real ou migração destrutiva
sem autorização. Funcionalidades que dependem de credenciais externas: implementar a estrutura,
documentar a configuração pendente e seguir adiante.

## R1. Redesign do frontend
Modernizar todas as páginas; identidade premium mantendo violeta e coral; referências Linear, ClickUp,
Asana, Monday; Design System consistente (tipografia, espaçamento, cores, ícones, componentes); tema claro,
escuro e automático; animações e microinterações; skeletons, tooltips, toasts, empty states; responsivo
(desktop, tablet, celular); acessibilidade; evitar visual de template administrativo.

## R2. Landing page comercial
Navbar; hero com a chamada **"Organize seu trabalho. Conecte sua equipe. Faça acontecer."**; demonstração
do sistema; funcionalidades; benefícios; planos e preços; comparação de planos; FAQ; formulário de contato;
botões de login e cadastro; rodapé institucional; política de privacidade; termos de uso; SEO e Open Graph.
**Não inventar depoimentos nem números de clientes.**

## R3. Autenticação
Login; cadastro; login com Google; recuperação e redefinição de senha; verificação de e-mail; indicador de
força da senha; refresh token; gerenciamento de sessões; 2FA; proteção de rotas; encerrar sessões em outros
dispositivos; onboarding; proteção contra força bruta.

## R4. Dashboard (dados reais)
Totais de projetos e tarefas; pendentes, em andamento, concluídas, atrasadas; próximos vencimentos;
percentual de conclusão; gráficos semanais e mensais; produtividade individual e da equipe; progresso dos
projetos; atividades recentes; próximos compromissos; atalhos rápidos; filtros por período, projeto e
responsável; widgets personalizáveis.

## R5. Sidebar e header
Sidebar recolhível e responsiva: Visão geral, Caixa de entrada, Minhas tarefas, Projetos, Kanban,
Calendário, Equipes, Documentos, Controle de tempo, Relatórios, Automações, Configurações, Notificações,
Integrações, Planos e assinatura, Ajuda e suporte. Header: busca global, seletor de workspace, sino com
contador de não lidas, avatar e menu de perfil, breadcrumbs, criação rápida, Command Palette (Ctrl+K).

## R6. Workspaces e organizações (multi-tenant)
Múltiplos workspaces; organizações; alternância; nome e logo; convites por e-mail; membros; equipes;
projetos independentes; permissões; transferência de propriedade; arquivamento; histórico de atividades.
**Isolamento rigoroso de dados entre organizações no backend e no banco.**

## R7. Projetos
Criar, editar, duplicar, arquivar, excluir (autorizado); nome, descrição, ícone, cor; responsáveis; equipes;
datas de início e conclusão; prioridade; status; progresso; objetivos; etiquetas; documentos; histórico;
templates.

## R8. Kanban avançado
Drag and drop fluido; colunas personalizáveis (criar/editar); ordenação persistida; limite (WIP) por coluna;
filtros avançados; busca; agrupamento por responsável, prioridade e etiqueta; criação rápida; seleção
múltipla; ações em massa; atualização otimista; tratamento de falhas; tempo real.
Visualizações: Kanban, Lista, Tabela, Calendário, Timeline, Gantt.

## R9. Tarefas
Título; descrição rica; um ou vários responsáveis; projeto; status; prioridade; início; prazo; estimativa;
tempo trabalhado; etiquetas; subtarefas; checklists; comentários; menções @; anexos; dependências;
seguidores; campos personalizados; histórico de alterações; recorrência; duplicação; templates;
arquivamento; lixeira e restauração; percentual de conclusão.

## R10. Notificações (prioritário)
- **Central:** sino, contador, dropdown, página completa, marcar como lida / todas, excluir, filtros,
  histórico, data e hora, link para a tarefa/projeto, tempo real, sons opcionais, toasts.
- **Eventos:** atribuição; alteração; mudança de status; prioridade; prazo; comentário; menção; conclusão;
  reabertura; atraso; prazo próximo; anexo; convite recebido; membro entrou; permissão alterada; projeto
  concluído; dependência desbloqueada; falha de automação; aviso administrativo.
- **Lembretes configuráveis:** 7 dias, 3 dias, 1 dia, 1 hora antes, no vencimento, após o vencimento,
  horários personalizados.
- **Web Push** (Service Worker + VAPID), também com o app fechado quando suportado; permissão contextual;
  clique abre o conteúdo.
- **E-mail** (Resend ou compatível) com templates: verificação, recuperação de senha, convite, tarefa
  atribuída, lembrete, atraso, menção, resumo diário, resumo semanal, alertas.
- **Preferências:** interna, push, e-mail, sons, categorias, horário silencioso, não perturbe, frequência,
  fuso horário, por projeto.
- **Backend:** persistência; WebSocket/Socket.IO; processamento assíncrono; filas; jobs agendados; retry;
  idempotência; deduplicação; logs de envio; monitoramento de falhas; controle de frequência; tratamento de
  inscrições push expiradas. Avaliar Redis/BullMQ ou alternativa. **Lembretes não podem depender só de
  timers em memória.**

## R11. Equipes e permissões
Equipes; convites; membros; avatares; cargos; departamentos; distribuição de tarefas; capacidade;
produtividade; histórico. RBAC: Proprietário, Administrador, Gestor, Membro, Convidado, Visualizador.
**Todas as permissões validadas no backend.**

## R12. Colaboração em tempo real
Comentários, respostas, menções, reações, feed de atividades, presença, tarefas e comentários em tempo real,
sincronização entre dispositivos, reconexão automática, conflitos de edição.

## R13. Calendário
Mensal, semanal, diário, agenda; eventos e reuniões; prazos; lembretes; filtros; criar tarefa pelo
calendário; arrastar para mudar datas; exportação ICS; Google Calendar (com credenciais).

## R14. Controle de tempo
Cronômetro por tarefa (iniciar/pausar/finalizar); registro manual; histórico; estimado × realizado; horas
por projeto e por usuário; relatórios; exportação; impedir sessões simultâneas indevidas.

## R15. Documentos e arquivos
Upload; download autorizado; pastas; organização por projeto; pré-visualização; busca; permissões;
validação; limites de armazenamento; URLs assinadas; editor rico; documentação interna.

## R16. Relatórios (dados reais)
Produtividade individual e de equipe; concluídas; atrasadas; tempo médio de conclusão; desempenho por
projeto; carga; taxa de conclusão; horas; evolução semanal/mensal; comparação de períodos; gráficos
interativos; filtros; exportação PDF, CSV e Excel.

## R17. Automações
Gatilhos → condições → ações (ex.: concluída → notificar gestor; atrasada → notificar responsável; nova →
atribuir; mudança de coluna → status; subtarefas concluídas → atualizar principal; projeto concluído →
notificar equipe; recorrente concluída → próxima ocorrência). Criar, editar, ativar, desativar, histórico;
prevenção de loops e controle de execução.

## R18. Inteligência artificial
Gerar tarefas, subtarefas e checklists; resumir projetos e comentários; sugerir prioridades; riscos de
atraso; planejamento; melhorar descrições; relatórios; sugerir automações. Arquitetura modular de
provedores; credenciais só no backend; **autorização explícita antes de a IA alterar dados**.

## R19. PWA
Manifest; Service Worker; ícones; splash; instalação desktop e celular; push; cache estratégico; tela
offline; indicador de conexão; sincronização; conflitos; limpeza de dados sensíveis no logout.

## R20. Busca global
Tarefas, projetos, usuários, equipes, documentos, comentários; sugestões, filtros, histórico, paginação,
debounce, atalhos. **Respeitar permissões em todos os resultados.**

## R21. Configurações
Perfil; foto; senha; idioma; fuso; aparência; notificações; segurança; sessões ativas; 2FA; integrações;
exportação de dados; exclusão de conta.

## R22. Monetização
Planos: **FREE R$ 0/mês · PRO R$ 29,90/mês · BUSINESS R$ 79,90/mês** (configuráveis). Página de preços;
comparação; controle de funcionalidades e limites por plano; checkout; assinatura recorrente; upgrade,
downgrade, cancelamento; teste grátis; histórico de pagamentos; cupons; webhooks seguros; idempotência
financeira. Avaliar Stripe ou Mercado Pago. **Somente ambiente de testes; nenhuma cobrança real sem
autorização.**

## R23. Painel administrativo da plataforma
Usuários (total, ativos, novos); organizações; assinaturas; MRR; cancelamentos; distribuição por plano;
conversão; logs; status dos serviços; gestão de usuários, planos e cupons; chamados; avisos globais;
auditoria administrativa. Proteção rigorosa e respeito à privacidade dos clientes.

## R24. Central de suporte
FAQ; base de conhecimento; tutoriais; contato; abertura e histórico de chamados; status; respostas
administrativas; sugestões; relato de bugs.

## R25. Banco de dados
Tabelas, relacionamentos, índices, constraints e migrations para tudo acima; integridade referencial;
transações; migrations versionadas; soft delete; isolamento multi-tenant; índices; paginação; backup e
restauração. **Preservar dados existentes; nada destrutivo sem autorização.**

## R26. Backend
Manter a stack; monólito modular (controllers, services, repositories, routes, middlewares, validators,
jobs, workers, events, config, tests); REST versionada; Swagger/OpenAPI; validação; erros globais; logs
estruturados; health checks; paginação, filtros, ordenação; cache; processamento assíncrono;
observabilidade; graceful shutdown.

## R27. Segurança
Hash de senha; JWT seguro; refresh tokens com rotação; rate limiting; Helmet; CORS restritivo; SQL
injection; XSS; CSRF quando aplicável; IDOR; validação; controle de acesso; isolamento; credenciais;
auditoria; uploads; HTTPS; segredos. OWASP Top 10 e LGPD.

## R28. Performance
Carregamento; lazy loading; code splitting; bundle; cache; requisições; SQL e índices; imagens; listas
longas; paginação; error boundaries; falhas de rede; Lighthouse e Core Web Vitals.

## R29. Testes
Unitários; integração; componentes; E2E (Playwright); autenticação; permissões; isolamento entre
organizações; notificações; lembretes; automações; pagamentos; responsividade; acessibilidade.

## R30. Infraestrutura
Variáveis de ambiente e `.env.example`; Docker e Docker Compose; GitHub Actions (CI/CD, build e testes);
monitoramento de erros; health checks; backups; rollback; produção e homologação. Manter compatibilidade
com GitHub Pages. Avaliar a hospedagem do backend para WebSocket, workers, Redis, jobs, e-mail e push.

## R31. Documentação
README, REQUISITOS, CLAUDE, ROADMAP, ARCHITECTURE, CHANGELOG, SECURITY, `.env.example` — atualizados
durante a implementação. Estados no roadmap: PENDENTE, EM DESENVOLVIMENTO, EM TESTES, CONCLUÍDO, BLOQUEADO.

## R32. Ordem de execução
1. Auditoria, arquitetura, segurança, banco, Design System.
2. Landing, autenticação, onboarding, dashboard, sidebar e header.
3. Workspaces, projetos, equipes, permissões, Kanban e tarefas.
4. Colaboração, notificações internas, lembretes, push e e-mails.
5. Calendário, tempo, documentos, relatórios, busca e automações.
6. Planos, pagamentos, painel administrativo e suporte.
7. PWA, IA, integrações, otimizações e testes finais.
