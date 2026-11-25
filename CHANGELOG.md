# Changelog

Todas as mudanças relevantes do Andamo. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem
[SemVer](https://semver.org/lang/pt-BR/). Cada fase do [ROADMAP](ROADMAP.md) gera uma entrada.

## [Não publicado]

### Adicionado

- Documentação de planejamento da evolução para SaaS: `REQUISITOS.md`, `ROADMAP.md`,
  `ARCHITECTURE.md`, `SECURITY.md` (com auditoria inicial), `CLAUDE.md` e este changelog.

## [1.0.0] — 2026-11-24

### Adicionado

- Nova marca **Andamo** (antigo TaskFlow) e versão full stack: API Express + PostgreSQL (Neon),
  autenticação JWT, tarefas por usuário com ordem persistida, importação das tarefas do
  `localStorage`, 58 testes automatizados e CI.

### Alterado

- Build da API no Render instala devDependencies e fixa Node 22.

## [0.x] — 2026-04

- Versão front-end only (TaskFlow): quadro Kanban com `localStorage`, publicado no GitHub Pages
  com `HashRouter`.
