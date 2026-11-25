import { column, createTask, expect, signUp, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("cria, edita e exclui tarefa; persiste após recarregar", async ({ page }) => {
  await createTask(page, "Escrever relatório");

  await page.getByRole("button", { name: "Ações da tarefa “Escrever relatório”" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Escrever relatório final");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(
    column(page, "A Fazer").getByText("Escrever relatório final", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ações da tarefa “Escrever relatório final”" }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir tarefa" }).click();
  await expect(page.getByText("Escrever relatório final", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Escrever relatório final", { exact: true })).toHaveCount(0);
});

test("move pelo menu e arrasta pelo teclado; a ordem persiste", async ({ page }) => {
  await createTask(page, "Primeira");
  await createTask(page, "Segunda");

  await page.getByRole("button", { name: "Ações da tarefa “Primeira”" }).click();
  await page.getByRole("menuitem", { name: "Em Progresso" }).click();
  await expect(column(page, "Em Progresso").getByText("Primeira", { exact: true })).toBeVisible();

  // Arrastar com teclado (KeyboardSensor do dnd-kit): Segunda vai para Em Progresso.
  const handle = page.getByRole("button", { name: "Arrastar “Segunda”" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  await expect(column(page, "Em Progresso").getByText("Segunda", { exact: true })).toBeVisible();

  await page.reload();
  const doing = column(page, "Em Progresso");
  await expect(doing.getByText("Primeira", { exact: true })).toBeVisible();
  await expect(doing.getByText("Segunda", { exact: true })).toBeVisible();
  await expect(column(page, "A Fazer").getByRole("listitem")).toHaveCount(0);
});

test("busca filtra o quadro e limpar filtros restaura", async ({ page }) => {
  await createTask(page, "Comprar café");
  await createTask(page, "Revisar contrato");

  await page.getByRole("searchbox", { name: "Buscar tarefas" }).fill("contrato");
  const todo = column(page, "A Fazer");
  await expect(todo.getByText("Revisar contrato", { exact: true })).toBeVisible();
  await expect(todo.getByText("Comprar café", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1 de 2 tarefas").first()).toBeVisible();

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(todo.getByText("Comprar café", { exact: true })).toBeVisible();
});

test("troca de tema aplica a classe dark e persiste", async ({ page }) => {
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitemradio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("@mobile cria tarefa pelo botão flutuante", async ({ page }) => {
  await createTask(page, "Tarefa no celular");
  await page.reload();
  await expect(page.getByText("Tarefa no celular", { exact: true })).toBeVisible();
});
