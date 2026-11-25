import { expect, signUp, test } from "./fixtures";

test("cadastro, sair e entrar de novo", async ({ page }) => {
  const { email, password } = await signUp(page);

  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/#\/entrar/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
});

test("login com senha errada mostra erro e não entra", async ({ page }) => {
  const { email } = await signUp(page);
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaErrada999");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/#\/entrar/);
});

test("rota protegida redireciona para o login e volta após entrar", async ({ page }) => {
  const { email, password } = await signUp(page);
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await page.goto("/#/app/design-system");
  await expect(page).toHaveURL(/#\/entrar/);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/#\/app\/design-system/);
});
