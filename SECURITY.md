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
| S-03 | Alta       | Token JWT de 7 dias salvo no `localStorage`, sem refresh e sem revogação: um XSS rouba a sessão por até uma semana e não há como encerrá-la.                                                                                       | 🟡 Fase 4: access de 15 min só em memória, refresh opaco rotativo com detecção de reuso e sessões revogáveis (encerrar vale na hora). O refresh ainda fica no `localStorage` (sem domínio, ADR-003): um XSS pode levá-lo, mas a sessão pode ser encerrada e o reuso derruba a sessão. Cookie HttpOnly quando houver domínio |
| S-04 | Média      | Cadastro responde `409 EMAIL_IN_USE`, permitindo descobrir quais e-mails têm conta.                                                                                                                                                | 🟡 Fase 4: login (mesma resposta e tempo para conta inexistente) e "esqueci a senha" (sempre 202) não revelam contas. O cadastro mantém o aviso de e-mail em uso por decisão de usabilidade, contido pelo limite por IP; revisar quando o envio de e-mail estiver ligado |
| S-05 | Média      | Sem verificação de e-mail: qualquer um cria conta com o e-mail de outra pessoa.                                                                                                                                                    | ✅ Fase 4: verificação por link de 24 h; Google não vincula sozinho a conta com e-mail não verificado |
| S-06 | Média      | Rate limit só em login/cadastro e em memória (zera a cada reinício).                                                                                                                                                               | ✅ Fase 4: bloqueio progressivo por conta no banco (5ª falha: 1, 2, 4… até 30 min) + limites por IP em login, e-mail e renovação. Store do limite por IP ainda em memória (compartilhado na Fase 6) |
| S-07 | Baixa      | Front no GitHub Pages: não permite cabeçalhos de segurança (CSP, HSTS).                                                                                                                                                            | 🟡 Parcial na Fase 3: CSP via `<meta>`, `referrer` e fontes locais; HSTS/headers HTTP dependem de sair do GitHub Pages (ADR-003) |
| S-08 | Baixa      | Custo do bcrypt 10.                                                                                                                                                                                                                | ✅ Fase 4: bcrypt 12 com rehash no login |

**Bugs encontrados na mesma análise (não são de segurança):**

| #    | Achado                                                                                                                                                                  | Correção                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| B-01 | Condição de corrida: `lockByUser` trava as **tarefas** do usuário; se ele ainda não tem nenhuma, nada é travado e duas criações simultâneas recebem a mesma `position`. | ✅ Resolvido na Fase 1 (trava a linha do usuário; teste de concorrência) |
| B-02 | `package.json` raiz descreve o projeto como "Prisma" e tem o script `db:studio`, que não existe na API.                                                                 | ✅ Resolvido na Fase 1                                                   |

## Fase 4 — controles novos

- Refresh tokens, tokens de e-mail, desafios de 2FA e códigos de recuperação guardados só como
  SHA-256; tokens de uso único consumidos de forma atômica.
- Chave TOTP cifrada (AES-256-GCM, `DATA_ENCRYPTION_KEY`); código TOTP não pode ser reutilizado;
  desafio de 2FA vale 5 min e 5 tentativas.
- Redefinir senha encerra todas as sessões; trocar a senha encerra as outras. Avisos por e-mail de
  troca de senha e de ativação/desativação do 2FA.
- Google: OAuth com `state` + PKCE, validação de `iss`/`aud`/`exp` do `id_token`; o front recebe só
  um código de troca de 60 s (os tokens nunca passam pela URL).
- Logs: `refreshToken`, `accessToken` e `token` na lista de redação; o mailer de desenvolvimento não
  registra destinatário nem links.

## Dependências de desenvolvimento (após a Fase 1)

`npm audit --omit=dev`: 0 vulnerabilidades. Restam alertas baixos/moderados que **não vão para
produção** e só afetam o servidor de desenvolvimento local:

- `esbuild` (moderada/baixa): leitura de arquivos pelo dev server; mitigado por rodar o dev server
  apenas em `localhost`.
- `postcss-selector-parser` via `@tailwindcss/typography` (moderada, CPU com seletores
  maliciosos): só processa o CSS do próprio projeto no build. A correção sugerida pelo npm é um
  downgrade; a migração para o Tailwind 4 será avaliada na Fase 2.

A CI bloqueia qualquer vulnerabilidade alta ou crítica (`npm run audit`).
