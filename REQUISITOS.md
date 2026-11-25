# REQUISITOS — Andamo SaaS

> Texto integral dos requisitos enviados por Israel Alcantara em 25/11/2026, sem edição.
> Referencie seções nos commits e no ROADMAP como `§N` (ex.: `§11` = notificações).
>
> **Atenção:** o texto recebido termina no meio do §27 ("Health checks"). Se houver seções
> seguintes (ex.: frontend, segurança, testes, DevOps, deploy), elas ainda precisam ser
> acrescentadas aqui.

---

Atue como um engenheiro de software sênior Full Stack, arquiteto de software, especialista em UI/UX Design, segurança, DevOps e desenvolvimento de produtos SaaS.

Quero evoluir meu projeto Andamo (antigo TaskFlow) para uma plataforma completa, moderna, profissional, escalável e comercializável de gerenciamento de projetos, tarefas, equipes e produtividade.

Utilize como referências Linear, ClickUp, Asana, Monday.com, Notion e Trello, mantendo uma identidade visual própria para o Andamo.

Quero uma aplicação real, totalmente funcional, com frontend, backend, banco de dados e integrações. Não quero apenas um protótipo visual.

## 1. ANÁLISE DO PROJETO ATUAL

Antes de iniciar:

- Analise todo o repositório e sua estrutura.
- Identifique as tecnologias e dependências existentes.
- Analise frontend, backend, banco de dados e infraestrutura.
- Identifique funcionalidades já implementadas.
- Identifique vulnerabilidades, bugs e problemas arquiteturais.
- Preserve tudo que já funciona corretamente.
- Aproveite os componentes existentes.
- Evite reconstruir o projeto desnecessariamente.
- Analise as configurações atuais de hospedagem e deploy.
- Verifique o estado do Git.
- Crie um planejamento técnico completo.

Crie os seguintes arquivos na raiz do projeto:

- REQUISITOS.md: todos os requisitos deste prompt.
- CLAUDE.md: instruções permanentes para o desenvolvimento.
- ROADMAP.md: fases, tarefas, prioridades e progresso.
- ARCHITECTURE.md: arquitetura e decisões técnicas.
- CHANGELOG.md: histórico de alterações.
- SECURITY.md: políticas e orientações de segurança.

Esses arquivos deverão permitir a continuidade do desenvolvimento em outras sessões do Claude Code.

## 2. REDESIGN COMPLETO DA INTERFACE

Transforme a interface em um produto SaaS premium.

Mantenha o nome Andamo e utilize a identidade violeta e coral existente como base.

Desenvolva:

- Design System completo.
- Design tokens centralizados.
- Paleta de cores profissional.
- Tipografia moderna.
- Componentes reutilizáveis.
- Layout minimalista.
- Hierarquia visual consistente.
- Tema claro.
- Tema escuro.
- Tema automático conforme o sistema.
- Animações suaves.
- Microinterações.
- Ícones modernos e consistentes.
- Skeleton loading.
- Tooltips.
- Toasts.
- Modais profissionais.
- Menus dropdown.
- Empty states personalizados.
- Estados de carregamento, sucesso e erro.
- Responsividade para desktop, tablet e celular.
- Acessibilidade WCAG 2.2 AA.
- Navegação por teclado.

Evite interfaces genéricas, excesso de gradientes, sombras exageradas e elementos desnecessários.

Quero uma experiência visual comparável à de produtos SaaS consolidados no mercado.

## 3. LANDING PAGE COMERCIAL

Crie uma landing page pública profissional antes da tela de login.

Utilize como chamada principal:

"Organize seu trabalho. Conecte sua equipe. Faça acontecer."

Inclua:

- Navbar moderna.
- Apresentação do produto.
- Hero section.
- Demonstração visual da plataforma.
- Screenshots reais do sistema.
- Apresentação das funcionalidades.
- Benefícios para empresas e profissionais.
- Seção de gestão de projetos.
- Seção de colaboração.
- Seção de notificações.
- Seção de produtividade.
- Comparação de planos.
- Perguntas frequentes.
- Formulário de contato.
- Botões de cadastro e login.
- Rodapé institucional.
- Política de privacidade.
- Termos de uso.
- SEO.
- Open Graph.
- Animações durante a navegação.

Não invente clientes, depoimentos, avaliações ou resultados comerciais.

## 4. AUTENTICAÇÃO E CADASTRO

Modernize completamente as telas de autenticação.

Implemente ou aprimore:

- Login com e-mail e senha.
- Cadastro de usuários.
- Login com Google.
- Verificação de e-mail.
- Recuperação de senha.
- Redefinição de senha.
- Indicador de força da senha.
- Mostrar e ocultar senha.
- Manter sessão conectada.
- Refresh token.
- Gerenciamento seguro de sessões.
- Encerramento de sessões em outros dispositivos.
- Autenticação de dois fatores.
- Proteção de rotas.
- Tratamento de sessão expirada.
- Proteção contra força bruta.
- Rate limiting.
- Onboarding de novos usuários.

No primeiro acesso, permita configurar o perfil, criar um workspace, convidar membros e criar o primeiro projeto.

## 5. DASHBOARD PRINCIPAL

Crie uma tela inicial completa com informações reais do banco de dados.

Apresente:

- Saudação personalizada.
- Total de projetos.
- Projetos ativos.
- Projetos concluídos.
- Total de tarefas.
- Tarefas pendentes.
- Tarefas em andamento.
- Tarefas concluídas.
- Tarefas atrasadas.
- Tarefas próximas do vencimento.
- Percentual de conclusão.
- Produtividade semanal.
- Produtividade mensal.
- Gráficos interativos.
- Distribuição por status.
- Distribuição por prioridade.
- Progresso dos projetos.
- Desempenho da equipe.
- Atividades recentes.
- Próximos compromissos.
- Minhas tarefas do dia.
- Atalhos para criação rápida.
- Filtros por período, projeto e responsável.

Permita personalizar os widgets do dashboard.

Não utilize dados fictícios em produção.

## 6. SIDEBAR E HEADER

Crie uma sidebar moderna, recolhível e responsiva.

Organize a navegação:

WORKSPACE

- Visão geral.
- Caixa de entrada.
- Minhas tarefas.
- Meus projetos.
- Quadro Kanban.
- Calendário.
- Equipes.
- Documentos.
- Controle de tempo.
- Relatórios.
- Automações.

PREFERÊNCIAS

- Configurações.
- Notificações.
- Integrações.
- Aparência.
- Planos e assinatura.
- Ajuda e suporte.

No header, adicione:

- Busca global.
- Seletor de workspace.
- Sino de notificações.
- Contador de notificações não lidas.
- Avatar do usuário.
- Menu de perfil.
- Breadcrumbs.
- Botão de criação rápida.
- Command Palette com Ctrl + K ou Cmd + K.

## 7. WORKSPACES E ORGANIZAÇÕES

Implemente arquitetura multi-tenant.

Permita:

- Criar múltiplos workspaces.
- Criar organizações.
- Alternar entre organizações.
- Personalizar nome, logo e identidade.
- Convidar usuários por e-mail.
- Gerenciar membros.
- Criar equipes.
- Definir permissões.
- Criar projetos independentes.
- Transferir propriedade.
- Arquivar organizações.
- Consultar histórico de atividades.

Garanta isolamento completo dos dados entre workspaces.

Um usuário jamais poderá acessar dados de uma organização sem autorização, mesmo manipulando diretamente requisições da API.

## 8. GERENCIAMENTO DE PROJETOS

Permita criar, editar, duplicar, arquivar e excluir projetos.

Cada projeto deverá possuir:

- Nome.
- Descrição.
- Ícone.
- Cor.
- Responsável.
- Equipe.
- Data de início.
- Prazo de conclusão.
- Status.
- Prioridade.
- Progresso.
- Objetivos.
- Etiquetas.
- Documentos.
- Histórico de atividades.
- Configurações próprias.

Crie templates de projetos para:

- Desenvolvimento de software.
- Marketing.
- Recursos humanos.
- Gestão administrativa.
- Gestão operacional.
- Projetos acadêmicos.
- Projetos pessoais.

## 9. KANBAN AVANÇADO

Evolua o quadro Kanban existente.

Implemente:

- Drag and drop fluido.
- Colunas personalizáveis.
- Criação, edição e exclusão de colunas.
- Ordenação de tarefas.
- Persistência da posição das tarefas.
- Cores por status.
- Limite de tarefas por coluna.
- Filtros avançados.
- Busca de tarefas.
- Agrupamento por prioridade.
- Agrupamento por responsável.
- Agrupamento por etiquetas.
- Criação rápida.
- Seleção múltipla.
- Edição em massa.
- Atualização otimista.
- Sincronização em tempo real.
- Tratamento de falhas de atualização.

Disponibilize diferentes visualizações:

- Kanban.
- Lista.
- Tabela.
- Calendário.
- Timeline.
- Gantt.

## 10. GERENCIAMENTO COMPLETO DE TAREFAS

Cada tarefa deverá possuir:

- Título.
- Descrição com editor de texto rico.
- Criador.
- Responsável.
- Múltiplos responsáveis.
- Projeto vinculado.
- Status.
- Prioridade.
- Data de início.
- Prazo.
- Estimativa de tempo.
- Tempo trabalhado.
- Etiquetas.
- Subtarefas.
- Checklists.
- Comentários.
- Menções com @.
- Anexos.
- Dependências.
- Seguidores.
- Campos personalizados.
- Histórico de alterações.

Implemente também:

- Tarefas recorrentes.
- Duplicação de tarefas.
- Templates de tarefas.
- Arquivamento.
- Lixeira.
- Restauração.
- Percentual de conclusão.
- Registro automático de conclusão.
- Compartilhamento com controle de acesso.

## 11. SISTEMA COMPLETO DE NOTIFICAÇÕES

Esta funcionalidade é prioritária.

Desenvolva uma central de notificações totalmente integrada ao backend e ao banco de dados.

### Notificações internas

- Sino de notificações no header.
- Contador de notificações não lidas.
- Dropdown com notificações recentes.
- Página completa de notificações.
- Marcar como lida.
- Marcar todas como lidas.
- Excluir notificações.
- Filtros por categoria.
- Agrupamento de notificações.
- Histórico de notificações.
- Data e horário.
- Redirecionamento para o conteúdo relacionado.
- Atualização em tempo real.
- Sons opcionais.

### Eventos que devem gerar notificações

- Nova tarefa atribuída.
- Alteração de responsável.
- Alteração de status.
- Alteração de prioridade.
- Alteração de prazo.
- Novo comentário.
- Menção em comentário.
- Novo arquivo anexado.
- Tarefa concluída.
- Tarefa reaberta.
- Tarefa atrasada.
- Prazo próximo.
- Convite para workspace.
- Convite para projeto.
- Novo membro na equipe.
- Alteração de permissões.
- Projeto concluído.
- Dependência desbloqueada.
- Falha em automação.
- Avisos administrativos.
- Alterações na assinatura.

### Lembretes automáticos

Permita configurar lembretes:

- Sete dias antes.
- Três dias antes.
- Um dia antes.
- Uma hora antes.
- No momento do vencimento.
- Após o vencimento.
- Em horários personalizados.

### Notificações push

Implemente Web Push Notifications com Service Workers e VAPID.

As notificações deverão funcionar:

- No computador.
- No celular.
- Com a aplicação aberta.
- Com a aplicação fechada, quando suportado pelo navegador e sistema operacional.

Solicite autorização do usuário antes de ativar notificações push.

Ao clicar em uma notificação, abra a tarefa, projeto ou conteúdo correspondente.

### Notificações por e-mail

Integre um serviço de e-mail transacional, preferencialmente Resend ou uma alternativa compatível com a infraestrutura.

Envie e-mails para:

- Verificação de conta.
- Recuperação de senha.
- Convites.
- Novas tarefas atribuídas.
- Lembretes de prazo.
- Tarefas atrasadas.
- Menções.
- Resumos diários.
- Resumos semanais.
- Alertas importantes.

Crie templates HTML profissionais e responsivos com a identidade visual do Andamo.

### Preferências de notificações

Permita configurar:

- Notificações internas.
- Notificações push.
- Notificações por e-mail.
- Categorias de notificações.
- Frequência de envio.
- Horário silencioso.
- Modo não perturbe.
- Sons.
- Fuso horário.
- Preferências por projeto.

### Arquitetura de notificações

Implemente:

- WebSocket ou Socket.IO.
- Persistência no banco de dados.
- Processamento assíncrono.
- Filas de processamento.
- Jobs agendados.
- Retry automático.
- Idempotência.
- Prevenção de notificações duplicadas.
- Logs de envio.
- Controle de frequência.
- Monitoramento de falhas.
- Tratamento de inscrições push expiradas.

Avalie Redis e BullMQ ou alternativas compatíveis com a infraestrutura existente.

Não utilize apenas timers em memória para lembretes importantes.

## 12. GESTÃO DE EQUIPES E PERMISSÕES

Implemente:

- Criação de equipes.
- Convites por e-mail.
- Cadastro de membros.
- Avatares.
- Perfis.
- Cargos.
- Departamentos.
- Projetos vinculados.
- Distribuição de tarefas.
- Capacidade de trabalho.
- Indicadores de produtividade.
- Histórico de atividades.

Crie controle de acesso baseado em papéis (RBAC):

- Proprietário.
- Administrador.
- Gestor.
- Membro.
- Convidado.
- Visualizador.

Todas as permissões devem ser validadas no backend.

## 13. COLABORAÇÃO EM TEMPO REAL

Implemente:

- Comentários em tarefas.
- Respostas aos comentários.
- Menções.
- Reações.
- Edição autorizada de comentários.
- Exclusão autorizada.
- Indicadores de usuários online.
- Atualização de tarefas em tempo real.
- Atualização de comentários em tempo real.
- Feed de atividades.
- Sincronização entre dispositivos.
- Reconexão automática.
- Tratamento de conflitos de edição.

## 14. CALENDÁRIO

Crie um calendário profissional integrado aos projetos e tarefas.

Inclua:

- Visualização mensal.
- Visualização semanal.
- Visualização diária.
- Visualização em agenda.
- Eventos.
- Reuniões.
- Prazos.
- Lembretes.
- Filtros por projeto.
- Filtros por responsável.
- Criação de tarefas pelo calendário.
- Alteração de datas por drag and drop.
- Exportação ICS.
- Integração com Google Calendar, mediante configuração das credenciais necessárias.

## 15. CONTROLE DE TEMPO

Implemente um módulo de Time Tracking.

Inclua:

- Cronômetro por tarefa.
- Iniciar, pausar e finalizar.
- Registro manual de horas.
- Histórico de sessões.
- Tempo estimado versus realizado.
- Horas por projeto.
- Horas por usuário.
- Relatórios de horas.
- Exportação.
- Prevenção de sessões simultâneas indevidas.

## 16. DOCUMENTOS E ARQUIVOS

Crie uma área de documentos vinculados aos projetos.

Implemente:

- Upload de arquivos.
- Download autorizado.
- Pastas.
- Organização por projeto.
- Pré-visualização de documentos.
- Busca.
- Controle de permissões.
- Limites de armazenamento.
- Validação de arquivos.
- URLs assinadas quando necessário.
- Editor de texto rico.
- Documentação interna.

Avalie serviços de armazenamento compatíveis com o projeto.

## 17. RELATÓRIOS E INDICADORES

Crie relatórios profissionais com:

- Produtividade individual.
- Produtividade da equipe.
- Tarefas concluídas por período.
- Tarefas atrasadas.
- Tempo médio de conclusão.
- Distribuição de tarefas.
- Desempenho por projeto.
- Carga de trabalho.
- Taxa de conclusão.
- Horas trabalhadas.
- Evolução semanal.
- Evolução mensal.
- Comparação entre períodos.

Adicione gráficos interativos e filtros avançados.

Permita exportação em PDF, CSV e Excel.

Todos os indicadores deverão utilizar dados reais.

## 18. AUTOMAÇÕES

Crie um módulo de automações baseado em gatilhos, condições e ações.

Exemplos:

- Quando uma tarefa for concluída, notificar o gestor.
- Quando uma tarefa atrasar, notificar o responsável.
- Quando uma tarefa mudar de coluna, atualizar seu status.
- Quando uma tarefa for criada, atribuir um responsável automaticamente.
- Quando todas as subtarefas forem concluídas, atualizar a tarefa principal.
- Quando uma tarefa recorrente for concluída, criar a próxima ocorrência.
- Quando um projeto atingir 100%, notificar a equipe.

Permita:

- Criar automações.
- Editar automações.
- Ativar e desativar.
- Configurar condições.
- Consultar histórico de execução.
- Consultar erros.
- Prevenir loops infinitos.
- Limitar execuções conforme o plano.

## 19. INTELIGÊNCIA ARTIFICIAL

Prepare uma arquitetura opcional para um assistente inteligente do Andamo.

Funcionalidades:

- Gerar tarefas a partir de descrições.
- Criar subtarefas.
- Resumir comentários.
- Resumir projetos.
- Sugerir prioridades.
- Identificar possíveis atrasos.
- Gerar relatórios.
- Auxiliar no planejamento.
- Melhorar descrições.
- Sugerir divisão de atividades.
- Criar planos de execução.
- Gerar checklists.
- Sugerir automações.

Avalie provedores de IA compatíveis com a infraestrutura e o orçamento.

Mantenha as chaves de API no backend.

A IA não poderá modificar ou excluir informações sem autorização do usuário.

## 20. PWA — APLICATIVO INSTALÁVEL

Transforme o Andamo em uma Progressive Web App.

Implemente:

- Web App Manifest.
- Service Worker.
- Ícones personalizados.
- Splash screen.
- Instalação no computador.
- Instalação no celular.
- Notificações push.
- Cache estratégico.
- Tela offline.
- Indicador de conexão.
- Sincronização de operações pendentes quando possível.
- Tratamento de conflitos.
- Limpeza de dados locais sensíveis ao encerrar a sessão.

Garanta compatibilidade com a hospedagem atual e com os navegadores suportados.

## 21. BUSCA GLOBAL

Implemente uma busca global para encontrar:

- Tarefas.
- Projetos.
- Usuários.
- Equipes.
- Documentos.
- Comentários.

Inclua:

- Sugestões em tempo real.
- Histórico de pesquisa.
- Filtros.
- Paginação.
- Debounce.
- Command Palette.
- Atalhos de teclado.
- Controle de acesso aos resultados.

## 22. CONFIGURAÇÕES DO USUÁRIO

Crie uma área completa de configurações.

Inclua:

- Dados pessoais.
- Foto de perfil.
- Alteração de senha.
- Idioma.
- Fuso horário.
- Aparência.
- Preferências de notificações.
- Segurança.
- Sessões ativas.
- Autenticação de dois fatores.
- Integrações.
- Exportação de dados pessoais.
- Solicitação de exclusão da conta.

## 23. PLANOS E ASSINATURAS

Prepare o Andamo para comercialização como SaaS.

Estruture inicialmente os seguintes planos:

### Free — R$ 0/mês

- Um workspace.
- Até três projetos.
- Gerenciamento básico de tarefas.
- Kanban.
- Notificações internas.

### Pro — R$ 29,90/mês

- Projetos ilimitados.
- Colaboração.
- Calendário.
- Relatórios avançados.
- Controle de tempo.
- Automações.
- Notificações push e e-mail.

### Business — R$ 79,90/mês

- Gestão de equipes.
- Permissões avançadas.
- Auditoria.
- Relatórios empresariais.
- Integrações.
- Maior armazenamento.
- Automações avançadas.

Esses valores são iniciais e deverão ser configuráveis.

Prepare integração com Stripe ou Mercado Pago.

Implemente:

- Checkout.
- Assinaturas recorrentes.
- Upgrade.
- Downgrade.
- Cancelamento.
- Período de teste.
- Histórico de pagamentos.
- Cupons de desconto.
- Webhooks com validação de assinatura.
- Idempotência.
- Controle de funcionalidades por plano.
- Validação de limites no backend.

Não habilite cobranças reais sem minha autorização.

## 24. PAINEL ADMINISTRATIVO DO SAAS

Crie um painel exclusivo para o administrador geral do Andamo.

Inclua:

- Total de usuários.
- Total de organizações.
- Usuários ativos.
- Novos cadastros.
- Assinaturas ativas.
- Receita recorrente mensal.
- Distribuição por planos.
- Cancelamentos.
- Taxa de conversão.
- Logs de erros.
- Status dos serviços.
- Gerenciamento de contas.
- Gerenciamento de planos.
- Gerenciamento de cupons.
- Chamados de suporte.
- Avisos globais.
- Auditoria administrativa.

Proteja rigorosamente o painel e respeite a privacidade dos clientes.

## 25. SUPORTE AO CLIENTE

Crie uma central de ajuda integrada ao sistema.

Inclua:

- FAQ.
- Base de conhecimento.
- Tutoriais.
- Formulário de contato.
- Abertura de chamados.
- Histórico de chamados.
- Status do atendimento.
- Respostas administrativas.
- Sugestões de melhorias.
- Reportar bugs.

## 26. BANCO DE DADOS

Analise o banco de dados atual e evolua sua modelagem.

Considere entidades para:

- Usuários.
- Perfis.
- Sessões.
- Workspaces.
- Membros.
- Equipes.
- Projetos.
- Colunas.
- Tarefas.
- Responsáveis.
- Subtarefas.
- Checklists.
- Dependências.
- Etiquetas.
- Comentários.
- Reações.
- Anexos.
- Notificações.
- Preferências de notificações.
- Inscrições push.
- Histórico de envios.
- Lembretes.
- Convites.
- Logs de atividades.
- Logs de auditoria.
- Registros de tempo.
- Eventos.
- Documentos.
- Automações.
- Histórico de automações.
- Integrações.
- Planos.
- Assinaturas.
- Pagamentos.
- Cupons.
- Chamados de suporte.

Implemente:

- Chaves primárias e estrangeiras.
- Índices.
- Constraints.
- Transações.
- Migrations versionadas.
- Integridade referencial.
- Soft delete quando apropriado.
- Isolamento multi-tenant.
- Paginação eficiente.
- Estratégia de backup.
- Estratégia de restauração.

Preserve os dados existentes.

Não execute migrations destrutivas sem autorização.

## 27. ARQUITETURA DO BACKEND

Preserve a stack existente sempre que possível.

Organize o backend por módulos e responsabilidades:

- Controllers.
- Services.
- Repositories.
- Routes.
- Middlewares.
- Validators.
- Jobs.
- Events.
- Workers.
- Configuration.
- Tests.

Implemente:

- API REST padronizada.
- Versionamento de API.
- Swagger/OpenAPI.
- Validação de dados.
- Tratamento global de erros.
- Logs estruturados.
- Health checks
- _(texto interrompido aqui — aguardando o restante)_
