import { column, createTask, expect, signUp, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("sidebar recolhe, lembra a escolha e navega", async ({ page }) => {
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(page.getByRole("button", { name: "Expandir menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu" }).click();

  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Design system" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toContainText(
    "Design system",
  );
});

test("criação rápida abre o formulário a partir de outra página", async ({ page }) => {
  await page.goto("/#/app/design-system");
  await page.getByRole("button", { name: "Criação rápida" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Via criação rápida");
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(
    column(page, "A Fazer").getByText("Via criação rápida", { exact: true }),
  ).toBeVisible();
});

test("paleta de comandos: Ctrl+K, busca tarefa e abre edição", async ({ page }) => {
  await createTask(page, "Preparar apresentação");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await expect(palette).toBeVisible();
  await page.keyboard.type("apresenta");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Editar tarefa" })).toBeVisible();
});

test("paleta de comandos troca o tema", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.keyboard.type("tema escuro");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("@mobile menu lateral abre como gaveta e navega", async ({ page }) => {
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Design system" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toBeHidden();
});
