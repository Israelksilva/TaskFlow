import { describe, expect, it } from "vitest";
import { passwordStrength } from "@andamo/shared";
import { plainText, renderMarkdown } from "./markdown";

describe("renderMarkdown (proteção contra XSS)", () => {
  it("escapa HTML antes de aplicar a formatação", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> **ok**');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<strong>ok</strong>");
  });

  it("só gera links http(s)/mailto, com rel seguro", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("href=");
    const html = renderMarkdown("[site](https://andamo.app)");
    expect(html).toContain('href="https://andamo.app"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("não permite quebrar o atributo href com aspas", () => {
    const html = renderMarkdown('[a](https://x.com/"onmouseover="alert(1))');
    expect(html).not.toMatch(/"\s*onmouseover=/);
  });

  it("renderiza menções, listas e checklists", () => {
    const html = renderMarkdown("@[Ana](11111111-1111-4111-8111-111111111111)\n- [x] feito\n- [ ] pendente");
    expect(html).toContain("@Ana");
    expect(html).toContain("☑ feito");
    expect(html).toContain("☐ pendente");
    expect(plainText("Oi @[Ana](11111111-1111-4111-8111-111111111111) **!**")).toBe("Oi @Ana !");
  });
});

describe("passwordStrength", () => {
  it("classifica senhas fracas e fortes", () => {
    expect(passwordStrength("senha123").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("Tr3m-Azul-Montanha!").score).toBe(4);
    expect(passwordStrength("").label).toBe("Muito fraca");
  });
});
