import { expect, type Page, test as base } from "@playwright/test";

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
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  return { email, password };
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
