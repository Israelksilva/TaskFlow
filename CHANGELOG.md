# Changelog

Todas as mudanças relevantes do Andamo. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem
[SemVer](https://semver.org/lang/pt-BR/). Cada fase do [ROADMAP](ROADMAP.md) gera uma entrada.

## [Não publicado]

### Fase 4 — Autenticação completa e segurança de contas

#### Adicionado

- Sessões renováveis: token de acesso de 15 minutos e renovação automática, "Manter conectado por 30
  dias", aviso de sessão expirada, sair em uma aba sai nas outras.
- Configurações da conta (`/#/app/configuracoes`): nome, fuso horário, tema, senha (ou definir senha
  em conta só Google), verificação em duas etapas, e-mail, Google e sessões ativas (encerrar uma ou
  todas as outras).
- Verificação em duas etapas com app autenticador (QR code) e 10 códigos de recuperação.
- Verificação de e-mail, "esqueci a senha" e redefinição por link; e-mails com a marca e avisos de
  segurança.
- Login com Google (desligado até as credenciais serem configuradas).
- Força da senha e botão mostrar/ocultar nos formulários.
- `GET /v1/auth/config`, rotas de sessão, e-mail, senha, 2FA, Google e `/v1/conta/*` (OpenAPI
  atualizado).
- Testes: 6 suítes novas na API, cliente de sessão e componentes no front, 7 E2E de conta e axe nas
  telas novas.

#### Alterado

- Login e cadastro devolvem `{ user, accessToken, refreshToken, expiresIn }` (antes `{ user, token }`).
- Bloqueio progressivo após falhas de login por conta; bcrypt 12 com rehash transparente.
- `JWT_EXPIRES_IN` substituída por `ACCESS_TOKEN_TTL_MIN`.

#### Atenção na implantação

- Migração aditiva `003`; quem estava logado precisa entrar de novo uma vez.
- Configure `APP_URL`, `API_PUBLIC_URL` e `DATA_ENCRYPTION_KEY` no Render. E-mail e Google só ligam
  com as respectivas chaves.

### Fase 3 — Landing page comercial, SEO e páginas legais

#### Adicionado

- Landing pública em `/`: hero, funcionalidades disponíveis, demonstração com capturas reais (claro,
  escuro, celular), pilares com selo "Disponível" ou "Em desenvolvimento", benefícios, planos Free,
  Pro e Business ("em breve", sem cobrança), perguntas frequentes e contato.
- Formulário de contato (`POST /v1/contato`) salvo no banco, com campo-isca, tempo mínimo de
  preenchimento e limite por IP; consentimento obrigatório.
- Política de Privacidade (`/#/privacidade`) e Termos de Uso (`/#/termos`) — rascunhos para revisão
  jurídica.
- SEO: título e descrição, Open Graph e Twitter Card com imagem, JSON-LD, `sitemap.xml`,
  `robots.txt` e URL canônica (`VITE_SITE_URL`).
- CSP via `<meta>` no build de produção.
- Testes: E2E da landing, contato, páginas legais e redirecionamentos; axe na landing e nas páginas
  legais; testes do formulário de contato.

#### Alterado

- O app passou para `/#/app` (o antigo `/#/design-system` redireciona). Após o login, o usuário volta
  para a página protegida que tentou abrir.
- Login e cadastro com painel violeta e captura real do quadro.
- Fontes servidas pelo próprio site, em vez do Google Fonts.
- Limites de tentativas configuráveis (`AUTH_LIMIT_PER_15MIN`, `CONTACT_LIMIT_PER_HOUR`).

### Fase 2 — Design system, AppShell e redesign

#### Adicionado

- AppShell: sidebar recolhível (lembra a escolha), gaveta no celular, breadcrumbs, botão de criação
  rápida, link "Pular para o conteúdo".
- Paleta de comandos (Ctrl/Cmd + K): nova tarefa, buscar no quadro, ir para páginas, abrir qualquer
  tarefa para edição, trocar tema e sair.
- Tokens de sombra, movimento e sidebar; componentes `Tabs`, `Breadcrumb`, `EmptyState`,
  `StatusMessage`, `Sheet` e `Command`; variantes `brand` (botão) e `brand/coral/success/warning`
  (badge).
- Página interna de referência do design system (`/#/design-system`).
- Testes E2E do AppShell e auditoria automática de acessibilidade (axe) nos temas claro e escuro.

#### Alterado

- Login e cadastro com painel da marca mais sóbrio (menos gradiente) e títulos maiores.
- Estados vazios do quadro usam o componente `EmptyState`.
- Modais com fundo translúcido mais leve; "Fechar" traduzido.
- Contraste de sucesso, atenção e erro ajustado para WCAG AA nos dois temas.

### Fase 1 — Fundação

#### Adicionado

- Rotas versionadas em `/v1` (as rotas sem prefixo continuam como aliases).
- `GET /health/live` e `GET /health/ready` (503 se o banco não responder); `/health` mantido.
- Cabeçalho `X-Request-Id` (gerado ou reaproveitado) e `requestId` em todos os logs.
- Rate limit global por IP (`RATE_LIMIT_PER_MINUTE`, padrão 300/min), além do de login/cadastro.
- Especificação OpenAPI 3.1 em `/v1/openapi.json`, gerada dos mesmos schemas Zod que validam a
  API, e página de referência em `/v1/docs`.
- Testes E2E com Playwright (cadastro, login, CRUD, mover e arrastar com persistência, busca,
  tema, celular) e job de E2E na CI.
- `npm audit --audit-level=high` na CI.

#### Corrigido

- B-01: criações/reordenações simultâneas num quadro vazio podiam gerar posições repetidas.
  Agora a transação trava a linha do usuário. Teste de concorrência incluído.
- B-02: removidas a menção a Prisma e o script `db:studio` inexistente.

#### Segurança

- S-01: Zod 3 → 4. S-02: React Router 6 → 7.
- Vite 5 → 8 e Vitest 3 → 5 (alertas alto/crítico das ferramentas de desenvolvimento).

### Fase 0 — Planejamento

#### Adicionado

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
