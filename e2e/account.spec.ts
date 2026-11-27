import { expect, fillLogin, logOut, signUp, test, tokenFromMail, totp } from "./fixtures";

const menu = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Menu da conta" });

test("sessão continua após recarregar a página (renovação pelo refresh token)", async ({
  page,
}) => {
  await signUp(page);
  await page.reload();
  await expect(menu(page)).toBeVisible();
  await page.goto("/#/app/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
});

test("esqueci a senha → link do e-mail → nova senha → entra", async ({ page }) => {
  const { email } = await signUp(page);
  await logOut(page);

  await page.getByRole("link", { name: "Esqueceu a senha?" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("você receberá o link");

  const token = await tokenFromMail(email, "reset_password");
  await page.goto(`/#/redefinir-senha?token=${token}`);
  await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha2026");
  await page.getByLabel("Confirmar nova senha", { exact: true }).fill("NovaSenha2026");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/#\/entrar/);

  // O link é de uso único.
  await page.goto(`/#/redefinir-senha?token=${token}`);
  await page.getByLabel("Nova senha", { exact: true }).fill("OutraSenha2026");
  await page.getByLabel("Confirmar nova senha", { exact: true }).fill("OutraSenha2026");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.goto("/#/entrar");
  await fillLogin(page, email, "NovaSenha2026");
  await expect(menu(page)).toBeVisible();
});

test("verifica o e-mail pelo link e o aviso some", async ({ page }) => {
  const { email } = await signUp(page);
  const banner = page.getByRole("region", { name: "Verificação de e-mail" });
  await expect(banner).toBeVisible();

  const token = await tokenFromMail(email, "verify_email");
  await page.goto(`/#/verificar-email?token=${token}`);
  await expect(page.getByText("E-mail confirmado")).toBeVisible();
  await page.getByRole("link", { name: "Ir para o quadro" }).click();
  await expect(menu(page)).toBeVisible();
  await expect(banner).toBeHidden();
});

test("2FA: ativa com o app, entra com código de recuperação e desativa", async ({ page }) => {
  const { email, password } = await signUp(page);
  await page.goto("/#/app/configuracoes?aba=seguranca");
  await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img", { name: /QR code/ })).toBeVisible();
  const secret = (await dialog.locator("code").innerText()).replace(/\s/g, "");
  await dialog.getByLabel("Código do app autenticador").fill(totp(secret));
  await dialog.getByRole("button", { name: "Ativar" }).click();

  const codeItems = dialog
    .getByRole("list", { name: "Códigos de recuperação" })
    .getByRole("listitem");
  await expect(codeItems).toHaveCount(10);
  const codes = await codeItems.allInnerTexts();
  expect(codes).toHaveLength(10);
  await dialog.getByRole("button", { name: "Guardei os códigos" }).click();
  await expect(page.getByText("10 códigos de recuperação restantes")).toBeVisible();

  await logOut(page);
  await fillLogin(page, email, password);
  await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toBeVisible();
  await page.getByRole("button", { name: "Usar código de recuperação" }).click();
  await page.getByLabel("Código de recuperação").fill(codes[0]!);
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(menu(page)).toBeVisible();

  await page.goto("/#/app/configuracoes?aba=seguranca");
  await expect(page.getByText("9 códigos de recuperação restantes")).toBeVisible();
  await page.getByRole("button", { name: "Desativar" }).click();
  await page.getByRole("dialog").getByLabel("Código do app ou de recuperação").fill(codes[1]!);
  await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
  await expect(
    page.getByRole("button", { name: "Ativar verificação em duas etapas" }),
  ).toBeVisible();
});

test("troca a senha nas configurações e entra com a nova", async ({ page }) => {
  const { email, password } = await signUp(page);
  await page.goto("/#/app/configuracoes?aba=seguranca");
  await page.getByLabel("Senha atual", { exact: true }).fill("errada-123");
  await page.getByLabel("Nova senha", { exact: true }).fill("Trocada2026x");
  await page.getByLabel("Confirmar nova senha", { exact: true }).fill("Trocada2026x");
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(page.getByText("Senha atual incorreta")).toBeVisible();
  // Senha errada com sessão ativa não desloga.
  await expect(menu(page)).toBeVisible();

  await page.getByLabel("Senha atual", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(page.getByText("Senha alterada")).toBeVisible();

  await logOut(page);
  await fillLogin(page, email, "Trocada2026x");
  await expect(menu(page)).toBeVisible();
});

test("atualiza o nome no perfil", async ({ page }) => {
  await signUp(page);
  await page.goto("/#/app/configuracoes");
  await page.getByLabel("Nome").fill("Pessoa Renomeada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Perfil atualizado.")).toBeVisible();
  await menu(page).click();
  await expect(page.getByRole("menu")).toContainText("Pessoa Renomeada");
});

test("encerrar as outras sessões desconecta o outro navegador", async ({ page, browser }) => {
  const { email, password } = await signUp(page);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/#/entrar");
  await fillLogin(otherPage, email, password);
  await expect(menu(otherPage)).toBeVisible();

  await page.goto("/#/app/configuracoes?aba=sessoes");
  await expect(page.getByText("Esta sessão")).toBeVisible();
  await page.getByRole("button", { name: "Encerrar as outras sessões" }).click();
  await expect(page.getByText("1 sessão encerrada.")).toBeVisible();

  await otherPage.reload();
  await expect(otherPage).toHaveURL(/#\/entrar/);
  await other.close();
});
