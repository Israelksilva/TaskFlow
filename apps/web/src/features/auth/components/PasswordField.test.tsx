import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("mostra e oculta a senha pelo botão", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Senha" defaultValue="segredo123" />);
    const input = screen.getByLabelText("Senha", { selector: "input" });
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("exibe a força da senha ligada ao campo", () => {
    const { rerender } = render(<PasswordField label="Senha" strengthOf="123456" />);
    expect(screen.getByText("Força: Muito fraca")).toBeInTheDocument();
    rerender(<PasswordField label="Senha" strengthOf="Correto-Cavalo-Bateria-9" />);
    expect(screen.getByText("Força: Forte")).toBeInTheDocument();
    const input = screen.getByLabelText("Senha", { selector: "input" });
    expect(input.getAttribute("aria-describedby")).toContain("strength");
  });
});
