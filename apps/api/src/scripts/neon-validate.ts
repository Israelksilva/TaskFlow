/**
 * Validação das migrações numa BRANCH DE TESTE do Neon (cópia da produção).
 *
 * Lê apenas NEON_TESTE_DATABASE_URL (arquivo apps/api/.env.neon-teste, ignorado pelo git).
 * Nunca usa DATABASE_URL. Do .env de produção lê só o host, para recusar se for o mesmo endpoint.
 *
 *   npm run neon:verificar -w @andamo/api                       # confere projeto/branch/endpoint (não altera nada)
 *   npm run neon:estado -w @andamo/api                          # registra estado atual (somente leitura)
 *   npm run neon:migrar -w @andamo/api -- --confirmo=ep-xxxx    # aplica pendentes e compara antes × depois
 *
 * Nada de senha ou string de conexão é exibido. Os registros salvos em .validacao-neon/ guardam
 * apenas ids e hashes (sem e-mails ou títulos em texto).
 */
import { readdirSync } from "node:fs";
import { createDatabase } from "../db/database";
import { migrate, MIGRATIONS_DIR } from "../db/migrate";
import { compare, describeUrl as describe, fail, printSnapshot, productionEndpoint, save, snapshot } from "./neon-validate-lib";

async function connect() {
  const url = process.env.NEON_TESTE_DATABASE_URL;
  if (!url) fail("Defina NEON_TESTE_DATABASE_URL em apps/api/.env.neon-teste (veja docs/VALIDACAO-NEON.md).");
  if (!/^postgres(ql)?:\/\//.test(url!)) fail("NEON_TESTE_DATABASE_URL precisa ser uma conexão postgresql:// do Neon.");
  const info = describe(url!);
  if (!["require", "verify-full", "verify-ca"].includes(info.sslmode ?? "")) {
    fail("A conexão precisa de SSL: a string do Neon deve terminar com ?sslmode=require");
  }
  if (!info.host.endsWith(".neon.tech")) fail(`O host ${info.host} não é do Neon.`);
  const prod = productionEndpoint();
  if (prod && prod === info.endpoint) {
    fail(`O endpoint ${info.endpoint} é o MESMO do apps/api/.env (produção). Use a string de conexão da branch de teste.`);
  }
  const db = createDatabase(url!);
  const { rows } = await db.query<{ db: string; usr: string; version: string; project: string | null; branch: string | null; ep: string | null }>(
    `SELECT current_database() AS db, current_user AS usr, split_part(version(), ' ', 2) AS version,
       current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch,
       current_setting('neon.endpoint_id', true) AS ep`,
  );
  return { db, info, prod, server: rows[0] };
}

function printTarget(t: Awaited<ReturnType<typeof connect>>) {
  console.log("\n🔎 Conexão de teste (sem senha):");
  console.log(`   endpoint ............ ${t.info.endpoint}`);
  console.log(`   host ................ ${t.info.host}`);
  console.log(`   banco / usuário ..... ${t.server.db} / ${t.server.usr}`);
  console.log(`   PostgreSQL .......... ${t.server.version}   sslmode=${t.info.sslmode ?? "(não informado)"}`);
  if (t.server.project) console.log(`   projeto Neon ........ ${t.server.project}`);
  if (t.server.branch) console.log(`   branch Neon (id) .... ${t.server.branch}`);
  console.log(`   endpoint produção ... ${t.prod ?? "(apps/api/.env sem DATABASE_URL — não foi possível comparar)"}`);
  console.log(t.prod ? "   ✅ Endpoint diferente do de produção." : "   ⚠️  Confira no painel do Neon que este endpoint é o da branch de teste.");
  console.log("   Compare com Neon → Branches → (sua branch de teste) → Computes: o id do endpoint deve ser o mesmo.\n");
}

// ------------------------------------------------------------------ comandos
const [cmd, ...args] = process.argv.slice(2);
if (cmd === "migrar") {
  // Confirmação conferida ANTES de qualquer conexão.
  const planned = describe(process.env.NEON_TESTE_DATABASE_URL ?? "").endpoint;
  const confirm = args.find((a) => a.startsWith("--confirmo="))?.split("=")[1];
  if (confirm !== planned) fail(`Para aplicar, rode antes "npm run neon:verificar" e repita o endpoint de TESTE: --confirmo=${planned}`);
}
const target = await connect();
printTarget(target);
const { db } = target;

try {
  if (cmd === "verificar") {
    // somente leitura: já exibido acima
  } else if (cmd === "estado") {
    const s = await snapshot(db, target.info.endpoint);
    printSnapshot(s, "Estado atual (somente leitura)");
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    console.log(`   pendentes: ${files.filter((f) => !s.migrations.includes(f)).join(", ") || "nenhuma"}`);
    console.log(`\n💾 Registro: ${save("estado", s)}\n`);
  } else if (cmd === "migrar") {
    if (!target.prod) fail("Não consegui ler o endpoint de produção em apps/api/.env para comparar. Por segurança, não vou migrar.");
    const before = await snapshot(db, target.info.endpoint);
    printSnapshot(before, "ANTES");
    const fileBefore = save("antes", before);
    const applied = await migrate(db);
    console.log(`\n⚙️  Migrações aplicadas agora: ${applied.length ? applied.join(", ") : "nenhuma (já estava atualizado)"}\n`);
    const after = await snapshot(db, target.info.endpoint);
    printSnapshot(after, "DEPOIS");
    const fileAfter = save("depois", after);
    const result = await compare(db, before, after);
    console.log("\n🧪 Comparação:");
    for (const o of result.ok) console.log(`   ✅ ${o}`);
    for (const p of result.problems) console.log(`   ❌ ${p}`);
    const report = save("relatorio", { applied, before: fileBefore, after: fileAfter, ...result });
    console.log(`\n💾 Relatório: ${report}`);
    console.log(result.problems.length ? "\n❌ Há problemas: NÃO aplique em produção.\n" : "\n✅ Migrações validadas na branch de teste.\n");
    if (result.problems.length) process.exitCode = 2;
  } else {
    console.log("Uso: neon:verificar | neon:estado | neon:migrar -- --confirmo=<endpoint>");
  }
} finally {
  await db.close();
}
