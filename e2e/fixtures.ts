import { createHash, createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";

/** Onde o DevMailer da API grava os e-mails (o Playwright roda na raiz do repositório). */
const MAIL_DIR = path.resolve("apps/api/.data/mails");

let seq = 0;

/** Cadastra um usuário novo pela interface e termina no quadro. */
export async function signUp(page: Page) {
  seq += 1;
  const email = `e2e-${Date.now()}-${process.pid}-${seq}@teste.local`;
  const password = "senhaE2E123";
  await page.goto("/#/cadastro");
  await page.getByLabel("Nome").fill("Pessoa E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  return { email, password };
}

/** Sai pelo menu da conta. */
export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/#\/entrar/);
}

/** Preenche o login (a etapa de 2FA, se houver, fica com o teste). */
export async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/** Último e-mail de um modelo enviado para o endereço (espera até 5 s). Devolve o token do link. */
export async function tokenFromMail(email: string, template: "verify_email" | "reset_password") {
  const suffix = `-${template}-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 12)}.html`;
  let token: string | undefined;
  await expect
    .poll(
      () => {
        const files = (() => {
          try {
            return readdirSync(MAIL_DIR)
              .filter((f) => f.endsWith(suffix))
              .sort();
          } catch {
            return [];
          }
        })();
        const last = files.at(-1);
        token = last
          ? /token=([A-Za-z0-9_-]+)/.exec(readFileSync(path.join(MAIL_DIR, last), "utf8"))?.[1]
          : undefined;
        return token;
      },
      { timeout: 5_000 },
    )
    .toBeTruthy();
  return token as string;
}

/** Código TOTP atual (RFC 6238, SHA-1, 6 dígitos, 30 s) a partir da chave base32. */
export function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/[\s=]/g, "").toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Cria uma tarefa pelo diálogo "Nova tarefa". */
export async function createTask(page: Page, title: string) {
  await page
    .getByRole("button", { name: /^Nova tarefa/ })
    .filter({ visible: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(title);
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(dialog).toBeHidden();
  await expect(column(page, "A Fazer").getByText(title, { exact: true })).toBeVisible();
}

export const column = (page: Page, label: string) =>
  page.getByRole("list", { name: `Tarefas em ${label}` });

export const test = base;
export { expect };
