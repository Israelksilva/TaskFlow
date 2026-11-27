# Validação das migrações numa branch de teste do Neon

Objetivo: aplicar as migrações pendentes (002 a 005) numa **cópia** da produção, comparar os dados antes e depois
e testar login e quadro, sem tocar na produção.

> ⚠️ Não rode `npm run db:migrate` localmente: ele lê `apps/api/.env`, que aponta para a **produção**.
> Use somente os comandos `neon:*` abaixo, que leem outro arquivo e recusam o endpoint de produção.

## 1. Criar a branch de teste (no painel do Neon)
1. Entre em <https://console.neon.tech> e abra o projeto do Andamo.
2. Menu **Branches** → **New branch** (ou **Create branch**).
3. **Parent branch**: a branch de produção (normalmente `main` ou `production`).
   **Include data up to**: *Current point in time* (dados de agora).
   **Name**: `teste-migracoes`.
4. Crie. O Neon cria um *compute* (endpoint) próprio para a branch — o id começa com `ep-`.

## 2. Pegar a conexão da branch de teste
1. Ainda no Neon, clique em **Connect** (no topo) e, no seletor **Branch**, escolha `teste-migracoes`
   (confira com atenção — não deixe em `main`).
2. Copie a *connection string* (formato `postgresql://...neon.tech/neondb?sslmode=require`).
3. No PowerShell:
   ```powershell
   cd C:\Projetos\Andamo\apps\api
   Copy-Item .env.neon-teste.example .env.neon-teste
   notepad .env.neon-teste
   ```
4. Substitua o valor de `NEON_TESTE_DATABASE_URL` pela string copiada, salve e feche.
   (O arquivo `.env.neon-teste` é ignorado pelo git; não envie a string para ninguém, nem para mim.)

## 3. Conferir o alvo (não altera nada)
```powershell
cd C:\Projetos\Andamo
npm run neon:verificar -w @andamo/api
```
Mostra endpoint, host, banco e usuário — **sem senha** — e compara com o endpoint de produção do `apps/api/.env`.
Confira no Neon: **Branches → teste-migracoes → Computes** → o id `ep-...` deve ser o mesmo exibido.
Se o endpoint for o de produção, o comando para com erro.

## 4. Registrar o estado atual (somente leitura)
```powershell
npm run neon:estado -w @andamo/api
```
Lista as migrações já aplicadas, as pendentes e a contagem de registros. O registro fica em
`apps/api/.validacao-neon/` (apenas ids e *hashes*, sem e-mails ou títulos).

## 5. Aplicar as pendentes e comparar
```powershell
npm run neon:migrar -w @andamo/api -- --confirmo=ep-xxxx-xxxx
```
(use o endpoint **de teste** mostrado no passo 3). O script:
1. registra o estado **antes**;
2. aplica, em ordem e em transação por arquivo, só as migrações pendentes;
3. registra o estado **depois** e compara:
   - todos os usuários continuam (mesmo e-mail, nome e data de cadastro);
   - todas as tarefas continuam (mesmo autor, título, descrição, status, prioridade, prazo e conclusão);
   - cada tarefa antiga está no workspace pessoal do seu dono, num projeto desse workspace e numa coluna coerente
     com o status; cada usuário tem um workspace pessoal e é proprietário dele.
Resultado “✅ Migrações validadas” = pode seguir. Qualquer “❌” = **não** aplique em produção.

## 6. Testar login e quadro com a app ligada à branch de teste
Em dois terminais:
```powershell
# Terminal 1 — API ligada à branch de teste (recusa produção; não envia e-mail/push)
cd C:\Projetos\Andamo
npm run dev:neon-teste -w @andamo/api

# Terminal 2 — front
cd C:\Projetos\Andamo
npm run dev:web
```
Abra <http://localhost:8080>, entre com a **sua** conta (a senha é a mesma da produção, porque a branch é uma
cópia) e abra o quadro “Minhas tarefas”. As tarefas antigas devem aparecer nas colunas certas.
Alterações feitas aqui ficam só na branch de teste.

## 7. Depois
- Branch aprovada → me avise; aplicar em produção só com sua autorização explícita (o deploy do Render roda as
  migrações no start). Faça antes um *snapshot*/branch de backup da produção.
- A branch de teste pode ser apagada no Neon quando não for mais útil.
