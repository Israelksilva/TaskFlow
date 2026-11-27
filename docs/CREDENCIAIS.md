# Credenciais das integrações

Os valores **nunca** vão para o repositório. Em produção, configure em **Render → serviço `andamo-api` →
Environment**. Para testar localmente, use `apps/api/.env` (ignorado pelo git) — lembrando que esse arquivo
aponta para o banco de produção, então prefira testar integrações com o banco embutido (`DATABASE_URL=pglite://...`).

O front-end **não** precisa de chaves: ele recebe da API (`/v1/config`) apenas o que é público
(Client ID do Google e chave pública VAPID).

Sem uma credencial, a integração fica **desligada e sinalizada** (painel admin → Status), nunca simulada.

| Integração | Variável (exata) | Onde gerar | Onde configurar |
|---|---|---|---|
| E-mail (Resend) | `RESEND_API_KEY` | resend.com → **API Keys** → *Create API Key* (permissão *Sending access*) | Render → Environment |
| | `EMAIL_FROM` | resend.com → **Domains** → adicionar e verificar seu domínio (registros DNS); use ex.: `Andamo <no-reply@seudominio.com>` | Render → Environment |
| Web Push | `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` | No PowerShell: `npx web-push generate-vapid-keys` (gera o par; guarde a privada com cuidado) | Render → Environment |
| | `VAPID_SUBJECT` | Um contato seu: `mailto:voce@seudominio.com` | Render → Environment |
| Login com Google | `GOOGLE_CLIENT_ID` | console.cloud.google.com → **APIs e serviços → Tela de consentimento OAuth** (configure) → **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em *Origens JavaScript autorizadas*, adicione `https://SEU-USUARIO.github.io` e `http://localhost:8080` | Render → Environment |
| Mercado Pago (teste) | `MP_ACCESS_TOKEN` | mercadopago.com.br/developers → **Suas integrações → Criar aplicação** (produto *Assinaturas*) → **Contas de teste** → crie um usuário de teste **vendedor** e outro **comprador** → entre com o vendedor de teste e copie o *Access Token* das credenciais dele. A API **recusa** credenciais que não sejam de usuário de teste. | Render → Environment |
| | `MP_WEBHOOK_SECRET` | Na aplicação do Mercado Pago → **Webhooks → Configurar notificações**: URL `https://SUA-API.onrender.com/v1/pagamentos/webhook`, evento *Planos e assinaturas*; copie a **assinatura secreta** | Render → Environment |
| Cloudflare R2 | `R2_ACCOUNT_ID` | dash.cloudflare.com → **R2** → o *Account ID* aparece na lateral da página do R2 | Render → Environment |
| | `R2_BUCKET` | **R2 → Create bucket** (ex.: `andamo-arquivos`). Deixe **sem acesso público** (não ative *Public access* nem domínio público) | Render → Environment |
| | `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` | **R2 → Manage R2 API Tokens → Create API token** → permissão *Object Read & Write*, **aplicada somente ao bucket acima** → copie *Access Key ID* e *Secret Access Key* (a secreta aparece uma vez) | Render → Environment |

Também no R2 (para upload direto do navegador): bucket → **Settings → CORS policy** → cole:
```json
[{ "AllowedOrigins": ["https://SEU-USUARIO.github.io", "http://localhost:8080"],
   "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

## Testar a assinatura (Mercado Pago, modo teste)
1. Com `MP_ACCESS_TOKEN` (do **vendedor de teste**) e `MP_WEBHOOK_SECRET` configurados, entre no Andamo como
   proprietário → **Planos e assinatura** → “Assinar o Pro (teste)”.
2. Informe o e-mail do **comprador de teste** e, no Mercado Pago, entre com essa conta de teste e use um
   cartão de teste (lista na documentação do Mercado Pago Developers, seção de testes de Assinaturas).
3. Ao voltar, a página consulta o status; o plano muda quando a assinatura fica “Ativa”.

## Como saber se ficou certo
Painel **Administração → Status** mostra cada integração como “configurado” ou “sem credenciais”.
Integrações ainda sem teste real estão listadas no `ROADMAP.md`.
