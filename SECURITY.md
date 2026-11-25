# Segurança do Andamo

## Como reportar uma vulnerabilidade
Não abra issue pública. Use o formulário de contato do site com o assunto "Segurança" e descreva o problema e
como reproduzi-lo. Responderemos o mais rápido possível.

## Controles implementados (OWASP Top 10)

| Risco | Controle |
|---|---|
| A01 Controle de acesso | RBAC validado no servidor (`rbac.ts` + `authorize`), isolamento por workspace, 404 para recursos de outros tenants, testes de IDOR e de papéis |
| A02 Criptografia | bcrypt (custo 10) para senhas; tokens de uso único e refresh tokens guardados como SHA-256; segredo 2FA com AES-256-GCM; HTTPS (Render/GitHub Pages) + HSTS via Helmet |
| A03 Injeção | 100% SQL parametrizado; nomes de coluna dinâmicos só de listas fixas; validação Zod de todas as entradas; `LIKE` com escape |
| A04 Design inseguro | refresh rotativo com detecção de reuso; tokens de e-mail de uso único e com expiração; convites presos ao e-mail convidado |
| A05 Configuração | Helmet (CSP `default-src 'none'` na API), CORS restrito, `x-powered-by` desligado, validação de env com falha rápida em produção |
| A06 Componentes | dependências fixadas no lockfile; `npm audit` recomendado no CI |
| A07 Autenticação | bloqueio após 5 falhas (15 min), rate limit por IP, 2FA TOTP, sessões revogáveis, nova senha encerra sessões |
| A08 Integridade | webhooks de pagamento: pendente (exigirão assinatura + idempotência) |
| A09 Logs | logs estruturados (pino) com redaction de `authorization` e senhas; `audit_log` para ações sensíveis; `X-Request-Id` |
| A10 SSRF | a API só chama URLs fixas (Resend, Google tokeninfo, endpoints Web Push validados como https) |

### XSS
React escapa por padrão. O único HTML gerado (Markdown de descrições/comentários) **escapa todo o texto antes** de
aplicar um conjunto fixo de tags; links só `http(s)`/`mailto` com `rel="noopener noreferrer nofollow"`.
Coberto por testes (`apps/web/src/lib/markdown.test.ts`). E-mails escapam conteúdo de usuário.

### LGPD
Exportação de dados (portabilidade), exclusão de conta (remove workspaces pessoais; tarefas em workspaces
compartilhados ficam sem autor), política de privacidade, minimização de dados (IP/UA só das sessões),
retenção automática (jobs 7 dias, logs de entrega 90 dias, sessões revogadas 30 dias).

## Segredos
- Nunca versionar `.env` (no `.gitignore`). Exemplos em `apps/api/.env.example`.
- Produção: `JWT_SECRET` forte (o boot falha com o valor de exemplo). `ENCRYPTION_KEY`, se definida, não deve
  ser trocada (os segredos de 2FA deixariam de abrir).
- Chaves de terceiros (Resend, VAPID privada, Google) só no backend. O front recebe apenas `googleClientId` e a
  chave VAPID **pública** por `/v1/config`.

## Operação
- **Backup**: o Neon mantém histórico (point-in-time restore conforme o plano). Antes de aplicar migrações em
  produção, crie um *branch* do banco no painel do Neon (restauração instantânea se algo der errado).
- **Rollback**: Render → Deploys → "Rollback" para o deploy anterior. As migrações são aditivas; a 002 não
  remove dados, mas o código antigo não conhece as novas colunas NOT NULL de `tasks` (`workspace_id`,
  `project_id`), portanto um rollback de código **após** a 002 exige restaurar o branch do Neon.

## Limitações conhecidas
- Tokens no `localStorage` (ver ARCHITECTURE.md → decisões). Uma XSS comprometeria a sessão; por isso o
  Markdown é estritamente sanitizado e não há HTML de usuário.
- Rate limit em memória (por instância). Em várias instâncias, usar store compartilhado.
- WebSocket: o token vai no subprotocolo (não na URL); a origem é validada contra `CORS_ORIGIN`; presença só é
  aceita para tarefas de workspaces dos quais o usuário é membro.
