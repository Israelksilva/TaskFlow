import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password";

describe("passwordStrength", () => {
  it("senhas comuns e repetidas são muito fracas", () => {
    expect(passwordStrength("senha123")).toBe(0);
    expect(passwordStrength("aaaaaaaa")).toBe(0);
    expect(passwordStrength("")).toBe(0);
  });

  it("penaliza senha que contém o nome ou o e-mail", () => {
    expect(passwordStrength("Israel2026!x", ["israel"])).toBe(1);
  });

  it("aumenta com tamanho e variedade", () => {
    expect(passwordStrength("abcdefg1")).toBeLessThan(passwordStrength("Abcdefg1!xyz"));
    expect(passwordStrength("Correto-Cavalo-Bateria-42")).toBe(4);
  });
});
