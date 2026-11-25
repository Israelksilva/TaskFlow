import { expect, signUp, test } from "./fixtures";

test("landing: hero, navegação por seções e CTA de cadastro", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Faça acontecer.");

  const nav = page.getByRole("navigation", { name: "Seções da página", exact: true });
  await nav.getByRole("button", { name: "Planos" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Comece grátis/ })).toBeInViewport();
  await expect(page.getByText("Em breve").first()).toBeVisible();

  await page.getByRole("link", { name: "Criar conta grátis" }).first().click();
  await expect(page).toHaveURL(/#\/cadastro/);
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
});

test("landing: formulário de contato valida e envia", async ({ page }) => {
  await page.goto("/#/");
  const form = page.getByRole("form", { name: "Formulário de contato" });
  await form.scrollIntoViewIfNeeded();

  await form.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(form.getByText(/Informe seu nome/)).toBeVisible();

  await form.getByLabel("Nome").fill("Pessoa E2E");
  await form.getByLabel("E-mail").fill("contato-e2e@teste.local");
  await form.getByLabel("Assunto").selectOption("comercial");
  await form.getByLabel("Mensagem").fill("Quero saber quando o plano Pro será lançado.");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByRole("status")).toContainText("Mensagem enviada");
});

test("páginas legais e link de volta para o contato", async ({ page }) => {
  await page.goto("/#/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Política de privacidade" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de Privacidade" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Rascunho em revisão jurídica");

  await page.getByRole("link", { name: "formulário de contato" }).first().click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("heading", { level: 2, name: "Fale com a gente" })).toBeInViewport();
});

test("usuário logado vê 'Abrir o app' e a rota antiga do design system redireciona", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/#/");
  await page.getByRole("link", { name: "Abrir o app" }).first().click();
  await expect(page).toHaveURL(/#\/app$/);

  await page.goto("/#/design-system");
  await expect(page).toHaveURL(/#\/app\/design-system/);
});

test("landing no celular: menu abre e leva à seção @mobile", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.locator("#menu-publico").getByRole("button", { name: "Perguntas" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Ficou alguma dúvida?" }),
  ).toBeInViewport();
});
