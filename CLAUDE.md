# CLAUDE.md — instruções permanentes para o desenvolvimento do Andamo

Andamo: gerenciador de tarefas Kanban full stack em evolução para SaaS multiempresa.

## Ao iniciar qualquer sessão

1. Leia [ROADMAP.md](ROADMAP.md) e encontre a fase atual (🟦) ou a última aprovada (✅).
2. Leia a seção correspondente de [REQUISITOS.md](REQUISITOS.md) (`§N`), [ARCHITECTURE.md](ARCHITECTURE.md)
   e [SECURITY.md](SECURITY.md).
3. Confira `git status` e a branch da fase (`fase-N-nome`).
4. Rode `npm test` para confirmar que a base está verde antes de mudar qualquer coisa.

## Processo (obrigatório)

- Trabalhe **somente na fase atual**. Fase ⏸ = concluída e aguardando aprovação: não comece a
  próxima sem autorização explícita do Israel.
- Ao concluir uma fase: marque as tarefas, atualize ARCHITECTURE ("Estado atual" e ADRs), CHANGELOG,
  README e SECURITY (se aplicável), marque a fase como ⏸ e **pare**.
- Commits pequenos citando a seção ou o achado (`§11: lembretes por job persistido`, `S-01: …`).
- Não faça push, PR, deploy, migração em produção nem configure cobrança real sem pedido.
- Migração destrutiva (DROP, remoção de coluna, perda de dados) só com autorização e backup.
- Decisão de produto ou arquitetura não escrita nos documentos → pergunte. Decisão nova tomada →
  registre como ADR.

## Comandos

```bash
npm install            # Node 22 (.nvmrc)
npm run dev            # API :3333 + web :8080 (proxy /api)
npm test               # shared + API (PGlite em memória) + web
npm run lint
npm run typecheck
npm run build
npm run db:migrate     # usa apps/api/.env; DATABASE_URL="pglite://./.data/dev" dispensa Neon
npm run db:seed        # demo@andamo.dev / demo1234 (só desenvolvimento)
```

Definição de pronto: `npm run lint && npm run typecheck && npm test && npm run build` verdes, mais os
E2E (a partir da Fase 1) e `npm audit --omit=dev` sem vulnerabilidade alta ou crítica.

## Regras do código

**Gerais**

- TypeScript estrito; `any` só com justificativa em comentário.
- Interface, mensagens de erro e rotas da API em **português**; identificadores em inglês.
- Schemas Zod, DTOs, matriz de permissões e regras de domínio compartilhadas ficam em
  `packages/shared`. Não duplique validação.
- Reaproveite componentes e módulos existentes; não reescreva o que funciona.

**API (`apps/api`)**

- Camadas: `routes → controller → service → repository`; jobs, eventos e workers em módulos próprios.
- SQL **sempre parametrizado**; nomes de coluna só de listas fixas.
- Migrações: arquivo novo `migrations/NNN_descricao.sql`; **nunca edite uma migração aplicada**.
  Migração com dados exige teste partindo do esquema anterior com dados.
- Multiempresa (a partir da Fase 5): repositórios de negócio exigem `workspaceId`; rotas passam por
  `authenticate → resolveWorkspace → loadMembership → requirePermission`. Recurso de outro
  workspace → **404**.
- Efeitos colaterais (notificação, e-mail, push, automação, tempo real) saem de eventos gravados no
  outbox na mesma transação e são processados por jobs idempotentes. Nunca use `setTimeout` para algo
  que precisa acontecer.
- Erros: classes de `shared/errors.ts`; formato `{ error: { code, message, details? } }` fixo.
- Reordenação do quadro: transação + trava + funções puras do shared (`moveTask`, `diffOrder`).
- Serviços externos atrás de interfaces com implementação fake; testes nunca acessam a rede.
- Segredos só em variáveis de ambiente do servidor. Nada sensível em `VITE_*`.

**Web (`apps/web`)**

- Cores, tipografia, espaçamento e movimento só via tokens do design system.
- Componentes base: shadcn em `components/ui`; não adicione outra biblioteca de componentes.
- React Query para dados do servidor, com chaves que incluem o workspace.
- Mutações do quadro otimistas com rollback.
- WCAG 2.2 AA: rótulos, foco visível, teclado, `aria-live`, contraste, `prefers-reduced-motion`.
- Marca: violeta `#6D5DFC` → púrpura `#A646F0`, coral `#FF8A65`; Plus Jakarta Sans + Inter; ícones Lucide.
- Tokens em `src/index.css` + `tailwind.config.ts`; todo token novo entra também em `/#/design-system`.
- Gradiente (`bg-brand` / `variant="brand"`) só na ação principal da tela e na identidade.
- Páginas logadas são rotas filhas de `AppShell`. Item novo na sidebar (`components/layout/nav.ts`)
  só quando a página funciona; registre também a trilha em `breadcrumbsFor`.
- Toda tela nova entra em `e2e/a11y.spec.ts` (axe, temas claro e escuro).

## Testes exigidos

| Mudança            | Teste mínimo                                                        |
| ------------------ | ------------------------------------------------------------------- |
| Regra de domínio   | unidade em `packages/shared`                                        |
| Rota nova          | Supertest: sucesso, 422, 401, 403 por cargo, 404 de outro workspace |
| Migração com dados | teste com dados no esquema anterior                                 |
| Job/evento         | idempotência e retry                                                |
| Tela ou fluxo novo | Testing Library + axe; E2E se for jornada principal                 |
| Bug                | teste que falhava antes da correção                                 |

## Nunca

- Quebrar funcionalidades existentes ou as rotas atuais sem fase de aposentadoria no ROADMAP.
- Usar dados fictícios em produção; inventar clientes, depoimentos ou números na landing; anunciar
  recurso que não existe.
- Expor chaves de API no front; registrar senhas, tokens ou dados pessoais em log.
- Trocar framework/ORM, reescrever módulos inteiros ou adicionar dependência pesada sem aprovação.
