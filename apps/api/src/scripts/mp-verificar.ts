/**
 * Confere as credenciais do Mercado Pago em apps/api/.env.neon-teste SEM exibir os valores.
 *   npm run mp:verificar -w @andamo/api
 * Não cria assinatura nem cobra nada: só consulta a conta dona do token (/users/me).
 */
import { randomBytes } from "node:crypto";

// A config da API exige banco e segredo; aqui não usamos banco nenhum.
process.env.DATABASE_URL = "pglite://memory";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.LOG_LEVEL = "silent";
process.env.PAYMENTS_ENABLED = "true"; // só para esta verificação local

const token = process.env.MP_ACCESS_TOKEN ?? "";
const secret = process.env.MP_WEBHOOK_SECRET ?? "";
const kind = token.startsWith("TEST-") ? "TEST-…" : token.startsWith("APP_USR-") ? "APP_USR-…" : token ? "formato desconhecido" : "ausente";

console.log("\n🔐 Mercado Pago (valores não são exibidos)");
console.log(`   MP_ACCESS_TOKEN ..... ${kind}${token ? ` (${token.length} caracteres)` : ""}`);
console.log(`   MP_WEBHOOK_SECRET ... ${secret ? `presente (${secret.length} caracteres)` : "ausente (necessário para o webhook)"}`);

if (!token) {
  console.log("\n❌ Coloque MP_ACCESS_TOKEN em apps/api/.env.neon-teste.\n");
  process.exit(1);
}
const { assertTestCredentials } = await import("../lib/mercadopago");
try {
  await assertTestCredentials();
  console.log("   Conta ................ ✅ de TESTE — liberada para o fluxo de assinatura de teste\n");
} catch (e) {
  console.log(`   Conta ................ ❌ ${(e as Error).message}\n`);
  process.exit(1);
}
