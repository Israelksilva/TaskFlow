/**
 * Sobe a API conectada à BRANCH DE TESTE do Neon (NEON_TESTE_DATABASE_URL), para testar login e quadro.
 * Recusa se o endpoint for o mesmo do apps/api/.env (produção). Não aplica migrações ao iniciar.
 *
 *   npm run dev:neon-teste -w @andamo/api
 */
import { randomBytes } from "node:crypto";
import { describeUrl, fail, productionEndpoint } from "./neon-validate-lib";

const url = process.env.NEON_TESTE_DATABASE_URL;
if (!url) fail("Defina NEON_TESTE_DATABASE_URL em apps/api/.env.neon-teste.");
const { endpoint, host } = describeUrl(url!);
if (!host.endsWith(".neon.tech")) fail(`O host ${host} não é do Neon.`);
const prod = productionEndpoint();
if (!prod) fail("Não consegui ler o endpoint de produção em apps/api/.env para comparar. Por segurança, não vou iniciar.");
if (prod === endpoint) fail(`O endpoint ${endpoint} é o de PRODUÇÃO. Use a branch de teste.`);

process.env.DATABASE_URL = url;
process.env.NODE_ENV = "development";
// Segredo efêmero: sessões desta execução valem só enquanto ela roda.
process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
// Sem credenciais reais de envio: nada sai por e-mail/push durante o teste.
for (const k of ["RESEND_API_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];

console.log(`\n🧪 API conectada à branch de teste (endpoint ${endpoint}) — produção (${prod}) não é usada.\n`);
await import("../server");
