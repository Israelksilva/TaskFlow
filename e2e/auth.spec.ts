import { expect, test } from "@playwright/test";
import { apiRegister, PASSWORD, signIn, uniqueEmail } from "./helpers";

test.describe("conta e acesso", () => {
  test("cadastro pela tela, onboarding e chegada ao app", async ({ page }) => {
    const email = uniqueEmail("cadastro");
    await page.goto("/#/cadastro");
    await page.getByLabel("Nome").fill("Rita Cadastro");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirmar senha").fill(PASSWORD);
    // Termos são obrigatórios.
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.getByText("Aceite os termos para continuar")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByRole("heading", { name: /boas-vindas, rita/i })).toBeVisible();
    await page.getByRole("button", { name: /começar/i }).click();
    await expect(page).toHaveURL(/#\/app\/w\//);
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  });

  test("login: senha errada mostra erro; senha certa entra; sair encerra a sessão", async ({ page, request }) => {
    const s = await apiRegister(request, "Lia Login");
    await page.goto("/#/entrar");
    await page.getByLabel("E-mail").fill(s.user.email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /e-mail ou senha/i })).toBeVisible();

    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    // Conta nova: o app leva ao onboarding antes do painel.
    await expect(page).toHaveURL(/#\/boas-vindas/);
    await page.getByRole("button", { name: /começar/i }).click();
    await expect(page).toHaveURL(/#\/app\/w\//);

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await page.getByRole("menuitem", { name: /sair/i }).click();
    await expect(page).toHaveURL(/#\/(entrar|$)/);
    await page.goto("/#/app");
    await expect(page).toHaveURL(/#\/entrar/);
  });

  test("área administrativa é bloqueada para usuário comum", async ({ page, request }) => {
    const s = await apiRegister(request, "Comum");
    await signIn(page, s, request);
    await page.goto("/#/app/admin");
    await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
    const res = await request.get("/api/v1/admin/visao-geral", { headers: { authorization: `Bearer ${s.token}` } });
    expect(res.status()).toBe(403);
  });
});
