# Segurança — Andamo

## Como reportar uma vulnerabilidade

Não abra issue pública. Envie os detalhes (passos para reproduzir, impacto, versão/commit) para o
responsável pelo projeto, Israel Alcantara, pelo e-mail de contato do perfil no GitHub. Resposta inicial em até
5 dias úteis. Até a correção ser publicada, mantenha a falha em sigilo.

## Versões suportadas

Somente a branch `main` em produção recebe correções.

---

## Políticas permanentes

**Autenticação e sessões**

- Senhas com bcrypt (custo ≥ 12 em produção a partir da Fase 4); nunca registradas em log.
- Mensagens de login, cadastro e recuperação nunca revelam se um e-mail existe.
- Tokens de verificação, redefinição, convite e refresh: aleatórios (≥ 32 bytes), de uso único,
  com expiração, **guardados apenas como hash**.
- Access token curto, em memória no navegador; refresh token em cookie `HttpOnly; Secure`, rotativo,
  com detecção de reuso (Fase 4).
- 2FA por TOTP com códigos de recuperação (Fase 4).

**Autorização e multiempresa**

- Toda permissão é decidida no backend. O front só esconde botões.
- Todo dado de negócio pertence a um workspace; repositórios exigem `workspaceId`.
- Recurso de outro workspace responde **404** (não confirma existência).
- Cada rota nova tem teste de acesso cruzado entre workspaces e de cada cargo.
- Painel administrativo do SaaS: papel separado, 2FA obrigatório, toda ação auditada, sem acesso
  ao conteúdo dos clientes por padrão.

**Entrada e saída**

- Toda entrada validada com Zod (`packages/shared`); campos desconhecidos rejeitados.
- SQL sempre parametrizado; nomes de coluna só de listas fixas.
- Texto rico sanitizado no servidor antes de salvar e renderizado sem `dangerouslySetInnerHTML`
  não sanitizado.
- Uploads: lista de tipos permitidos por conteúdo (não só extensão), limite de tamanho por plano,
  armazenamento fora do servidor, download só por URL assinada de curta duração.

**Infraestrutura**

- Segredos só em variáveis de ambiente do servidor; `.env` fora do git; nada sensível no front
  (variáveis `VITE_*` são públicas).
- Cabeçalhos: helmet na API; CSP, HSTS, `X-Content-Type-Options` e `Referrer-Policy` no front
  (exige hospedagem que permita cabeçalhos — ver ADR-002).
- Rate limiting global e por rota sensível; limites de corpo de requisição.
- Webhooks (pagamentos) só aceitos com assinatura válida e processados de forma idempotente.
- Chaves de IA, e-mail, pagamento e armazenamento apenas no backend.
- Dependências: `npm audit` no CI; vulnerabilidade alta ou crítica bloqueia o merge.
- Logs estruturados sem dados pessoais desnecessários, sem tokens e sem senhas.

**Dados e privacidade (LGPD)**

- Usuário pode exportar seus dados e pedir exclusão da conta.
- Backups criptografados com restauração testada periodicamente.
- Migrações destrutivas só com autorização explícita e backup prévio.
- Cobranças reais só com autorização explícita do responsável pelo projeto.

---

## Auditoria inicial — 25/11/2026 (commit `7bf1d41`)

| #    | Severidade | Achado                                                                                                                                                                                                                             | Correção prevista                                                                            |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| S-01 | Alta       | `zod@3.25.76` vulnerável a esgotamento de memória ao validar coleções grandes com restrições ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). A API valida arrays (ex.: importação de até 500 tarefas). | ✅ Resolvido na Fase 1 (Zod 4)                                                               |
| S-02 | Média      | `react-router@6.30.6`: open redirect via barra invertida em `<Link>`/`useNavigate` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)).                                                                     | ✅ Resolvido na Fase 1 (React Router 7)                                                      |
| S-03 | Alta       | Token JWT de 7 dias salvo no `localStorage`, sem refresh e sem revogação: um XSS rouba a sessão por até uma semana e não há como encerrá-la.                                                                                       | Fase 4: access curto em memória + refresh rotativo em cookie HttpOnly + sessões revogáveis   |
| S-04 | Média      | Cadastro responde `409 EMAIL_IN_USE`, permitindo descobrir quais e-mails têm conta.                                                                                                                                                | Fase 4: resposta genérica + e-mail ao dono da conta                                          |
| S-05 | Média      | Sem verificação de e-mail: qualquer um cria conta com o e-mail de outra pessoa.                                                                                                                                                    | Fase 4                                                                                       |
| S-06 | Média      | Rate limit só em login/cadastro e em memória (zera a cada reinício).                                                                                                                                                               | Fase 1 ✅ limite global por IP; Fase 4: por conta, store compartilhado, bloqueio progressivo |
| S-07 | Baixa      | Front no GitHub Pages: não permite cabeçalhos de segurança (CSP, HSTS).                                                                                                                                                            | 🟡 Parcial na Fase 3: CSP via `<meta>`, `referrer` e fontes locais; HSTS/headers HTTP dependem de sair do GitHub Pages (ADR-003) |
| S-08 | Baixa      | Custo do bcrypt 10.                                                                                                                                                                                                                | Fase 4: 12, com rehash transparente no login                                                 |

**Bugs encontrados na mesma análise (não são de segurança):**

| #    | Achado                                                                                                                                                                  | Correção                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| B-01 | Condição de corrida: `lockByUser` trava as **tarefas** do usuário; se ele ainda não tem nenhuma, nada é travado e duas criações simultâneas recebem a mesma `position`. | ✅ Resolvido na Fase 1 (trava a linha do usuário; teste de concorrência) |
| B-02 | `package.json` raiz descreve o projeto como "Prisma" e tem o script `db:studio`, que não existe na API.                                                                 | ✅ Resolvido na Fase 1                                                   |

## Dependências de desenvolvimento (após a Fase 1)

`npm audit --omit=dev`: 0 vulnerabilidades. Restam alertas baixos/moderados que **não vão para
produção** e só afetam o servidor de desenvolvimento local:

- `esbuild` (moderada/baixa): leitura de arquivos pelo dev server; mitigado por rodar o dev server
  apenas em `localhost`.
- `postcss-selector-parser` via `@tailwindcss/typography` (moderada, CPU com seletores
  maliciosos): só processa o CSS do próprio projeto no build. A correção sugerida pelo npm é um
  downgrade; a migração para o Tailwind 4 será avaliada na Fase 2.

A CI bloqueia qualquer vulnerabilidade alta ou crítica (`npm run audit`).
