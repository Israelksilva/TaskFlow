# CLAUDE.md — guia para sessões de desenvolvimento

## Antes de começar
- Leia `ROADMAP.md` (estado de cada requisito e próximos passos) e `REQUISITOS.md` (escopo completo).
- Arquitetura e decisões: `ARCHITECTURE.md`. Segurança: `SECURITY.md`.
- Idioma do produto, código comentado e commits: **português**.

## Comandos
```bash
npm install
npm run lint && npm run typecheck && npm test && npm run build   # obrigatório antes de cada commit
npm run dev            # API (3333) + web (8080) — a API lê apps/api/.env
```
Desenvolvimento **sem** tocar no banco de produção (o `apps/api/.env` pode apontar para o Neon real):
```bash
cd apps/api && DATABASE_URL=pglite://./.data/dev JWT_SECRET=dev-secret-dev-secret-dev-secret-dev npx tsx src/server.ts
cd apps/web && npx vite --port 8080       # proxy /api → 3333 (inclui WebSocket)
```
No Git Bash do Windows, não passe `VITE_API_URL=/api` na linha de comando (o MSYS converte em caminho); o padrão já é `/api`.

## Regras do projeto
- Nunca: `git push`, deploy, migração destrutiva, cobrança real — sem autorização explícita do usuário.
- Migrações: novo arquivo `apps/api/migrations/NNN_nome.sql`, aditivo, testado sobre dados existentes
  (ver `tests/migration.test.ts`). O migrador separa comandos por `;` no fim da linha: evite blocos `DO $$`.
- Toda consulta é parametrizada; colunas dinâmicas só de listas fixas.
- Toda rota de tenant fica sob `/v1/workspaces/:workspaceId` (middleware `requireWorkspace`) e todo repositório
  filtra por `workspace_id`. Permissões: `packages/shared/src/rbac.ts` + `authorize()`/checagens no service.
- Contratos (schemas Zod, DTOs) vivem em `packages/shared` e são usados pelos dois lados.
- Integrações externas: implementar a estrutura, ler a credencial do env e **não fingir** funcionamento sem ela
  (ver `integrations` em `config/env.ts` e `/v1/config`).
- Não criar botões/itens de menu sem funcionalidade real.
- Após o trabalho, atualize `ROADMAP.md` e `CHANGELOG.md`.

## Mapa rápido
- API: `apps/api/src/modules/<domínio>` · fila: `src/jobs` · eventos: `src/events/bus.ts` · tempo real: `src/realtime/hub.ts`
- Web: `apps/web/src/features/<domínio>` · layout: `src/components/layout/AppShell.tsx` · rotas: `src/App.tsx`
- Testes da API usam PGlite em memória; helpers em `apps/api/tests/helpers.ts` (`addMember`, `tokenFromMail`, `runPendingJobs`).
