import { expect, test, type Page } from "@playwright/test";
import { apiRegister, personalWorkspace, signIn } from "./helpers";

const column = (page: Page, name: string | RegExp) => page.getByRole("region", { name });

test.describe("projetos, quadro e tempo", () => {
  test("cria projeto e tarefa, move pelo menu do cartão e a mudança persiste", async ({ page, request }) => {
    const s = await apiRegister(request, "Bia Quadro");
    await signIn(page, s, request);
    const ws = await personalWorkspace(request, s);

    await page.goto(`/#/app/w/${ws}/projetos`);
    await page.getByRole("main").getByRole("button", { name: "Novo projeto" }).click();
    await page.getByLabel("Nome").fill("Site novo");
    await page.getByRole("button", { name: "Criar projeto" }).click();
    await expect(page).toHaveURL(/projetos\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Site novo" })).toBeVisible();

    const todo = column(page, /^A fazer/i);
    await todo.getByRole("button", { name: "Adicionar tarefa" }).click();
    await page.getByLabel("Título *").fill("Escrever textos da home");
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(todo.getByText("Escrever textos da home")).toBeVisible();

    await page.getByRole("button", { name: "Ações da tarefa “Escrever textos da home”" }).click();
    await page.getByRole("menuitem", { name: /Concluíd/ }).click();
    const done = column(page, /^Concluíd/);
    await expect(done.getByText("Escrever textos da home")).toBeVisible();
    await expect(todo.getByText("Escrever textos da home")).toHaveCount(0);

    await page.reload();
    await expect(column(page, /^Concluíd/).getByText("Escrever textos da home")).toBeVisible();
  });

  test("cronômetro: inicia na tarefa, aparece no cabeçalho e para", async ({ page, request }) => {
    const s = await apiRegister(request, "Davi Tempo");
    await signIn(page, s, request);
    const ws = await personalWorkspace(request, s);

    await page.goto(`/#/app/w/${ws}/minhas-tarefas`);
    await page.getByRole("button", { name: "Criar tarefa" }).first().click();
    await page.getByLabel(/^Título/).fill("Revisar contrato");
    await page.getByRole("dialog").getByRole("button", { name: /Criar tarefa|Criar/ }).click();
    await page.getByRole("main").getByText("Revisar contrato").click();

    await page.getByRole("button", { name: /Iniciar cronômetro/ }).click();
    await expect(page.getByRole("link", { name: /Cronômetro em Revisar contrato/ })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /^Pausar/ }).click();
    await expect(page.getByRole("link", { name: /Cronômetro em Revisar contrato/ })).toHaveCount(0);

    // O registro aparece no controle de tempo.
    await page.keyboard.press("Escape");
    await page.goto(`/#/app/w/${ws}/tempo`);
    await expect(page.getByText("Revisar contrato").first()).toBeVisible();
  });
});
