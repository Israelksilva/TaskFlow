import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createTask, expect, signUp, test } from "./fixtures";

/** Auditoria automática WCAG 2.2 A/AA com axe-core. */
async function expectNoViolations(page: Page, label: string) {
  // Espera animações de entrada terminarem (opacidade parcial gera falso positivo de contraste).
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any[0]?.message ?? ""}]`).join(" | ")}`,
  );
  expect(summary, `Violações em ${label}`).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme}`, () => {
    test.use({ colorScheme: theme });

    test("login e cadastro", async ({ page }) => {
      await page.goto("/#/entrar");
      await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
      await expectNoViolations(page, "login");
      await page.goto("/#/cadastro");
      await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
      await expectNoViolations(page, "cadastro");
    });

    test("quadro vazio, com tarefas, modal e paleta", async ({ page }) => {
      await signUp(page);
      await expect(page.getByRole("heading", { name: "Seu quadro está vazio" })).toBeVisible();
      await expectNoViolations(page, "quadro vazio");

      await createTask(page, "Tarefa acessível");
      await expectNoViolations(page, "quadro com tarefas");

      await page
        .getByRole("button", { name: /^Nova tarefa/ })
        .filter({ visible: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoViolations(page, "modal de nova tarefa");
      await page.keyboard.press("Escape");

      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
      await expectNoViolations(page, "paleta de comandos");
    });

    test("design system", async ({ page }) => {
      await signUp(page);
      await page.goto("/#/design-system");
      for (const tab of ["Fundamentos", "Componentes", "Feedback"]) {
        await page.getByRole("tab", { name: tab }).click();
        await expectNoViolations(page, `design system / ${tab}`);
      }
    });
  });
}
