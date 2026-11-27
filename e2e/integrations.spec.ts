import { expect, test } from "@playwright/test";
import { api, apiRegister, personalWorkspace, signIn } from "./helpers";

/**
 * Sem credenciais (como no E2E), Mercado Pago e R2 aparecem como indisponíveis — nunca simulados.
 * Os fluxos com provedor são cobertos pelos testes da API com o provedor simulado.
 */
test.describe("integrações sem credenciais", () => {
  test("planos: assinatura em modo teste indisponível, sem botão de assinar", async ({ page, request }) => {
    const s = await apiRegister(request, "Pat Planos");
    await signIn(page, s, request);
    const ws = await personalWorkspace(request, s);
    await page.goto(`/#/app/w/${ws}/planos`);
    await expect(page.getByText("Modo de teste — sem cobrança real")).toBeVisible();
    await expect(page.getByText(/pagamento online ainda não foi configurado/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Assinar o/ })).toHaveCount(0);
    await expect(page.getByText("Assistente de IA")).toHaveCount(0);
  });

  test("arquivos: projeto e tarefa informam que o armazenamento não está configurado", async ({ page, request }) => {
    const s = await apiRegister(request, "Fê Arquivos");
    await signIn(page, s, request);
    const ws = await personalWorkspace(request, s);
    const { projects } = await api<{ projects: Array<{ id: string }> }>(request, s, "GET", `/v1/workspaces/${ws}/projetos`);
    await page.goto(`/#/app/w/${ws}/projetos/${projects[0].id}?visao=arquivos`);
    await expect(page.getByRole("tab", { name: "Arquivos" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/Anexos indisponíveis/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Enviar arquivos/ })).toHaveCount(0);
  });
});
