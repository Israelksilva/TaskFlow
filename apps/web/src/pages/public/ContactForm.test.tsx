import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ContactForm } from "./ContactForm";

const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ContactForm />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome"), "Ana Souza");
  await user.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
  await user.selectOptions(screen.getByLabelText("Assunto"), "suporte");
  await user.type(screen.getByLabelText("Mensagem"), "Não consigo arrastar tarefas no tablet.");
  await user.click(screen.getByRole("checkbox"));
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("ContactForm", () => {
  it("valida campos obrigatórios e o consentimento sem chamar a API", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(await screen.findByText("Informe seu nome")).toBeInTheDocument();
    expect(
      screen.getByText("É preciso concordar com a Política de Privacidade"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia os dados com o tempo de preenchimento e mostra a confirmação", async () => {
    fetchMock.mockReturnValueOnce(json(201, { ok: true }));
    const user = setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Mensagem enviada");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/contato$/);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ name: "Ana Souza", topic: "suporte", consent: true, website: "" });
    expect(typeof body.elapsedMs).toBe("number");
  });

  it("mostra os erros de validação devolvidos pela API no campo certo", async () => {
    fetchMock.mockReturnValueOnce(
      json(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: { email: ["E-mail inválido"] },
        },
      }),
    );
    const user = setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await waitFor(() => expect(screen.getByText("E-mail inválido")).toBeInTheDocument());
  });
});
