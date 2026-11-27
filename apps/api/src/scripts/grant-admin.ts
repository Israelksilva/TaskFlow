/**
 * Concede (ou remove) acesso ao painel administrativo da plataforma.
 * Não existe rota HTTP para isso — de propósito: só quem tem acesso ao servidor/banco promove alguém.
 *
 *   npm run admin:grant -w @andamo/api -- pessoa@empresa.com
 *   npm run admin:grant -w @andamo/api -- pessoa@empresa.com --revoke
 *
 * A pessoa também precisa ativar a verificação em duas etapas para entrar no painel.
 */
import { db } from "../db";
import { audit } from "../modules/audit/audit";

const [email, flag] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Uso: npm run admin:grant -w @andamo/api -- email@dominio.com [--revoke]");
  process.exit(1);
}
const grant = flag !== "--revoke";
const { rows } = await db.query<{ id: string }>(
  `UPDATE users SET is_platform_admin = $2, updated_at = now() WHERE lower(email) = lower($1) AND deleted_at IS NULL RETURNING id`,
  [email, grant],
);
if (!rows[0]) {
  console.error(`Nenhuma conta encontrada com o e-mail ${email}`);
  process.exitCode = 1;
} else {
  await audit({ actorId: null, action: grant ? "admin.granted_cli" : "admin.revoked_cli", target: rows[0].id });
  console.log(grant ? `✅ ${email} agora é administrador(a) da plataforma (exige 2FA ativo).` : `✅ Acesso administrativo removido de ${email}.`);
}
await db.close();
