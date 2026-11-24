import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task } from "@andamo/shared";
import { TaskFormDialog } from "./TaskFormDialog";

const savedTask: Task = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Revisar proposta",
  description: "Conferir valores",
  priority: "alta",
  status: "doing",
  position: 0,
  dueDate: "2030-01-10",
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function setup(props: Partial<Parameters<typeof TaskFormDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TaskFormDialog open onOpenChange={onOpenChange} {...props} />
    </QueryClientProvider>,
  );
  return { onOpenChange, user: userEvent.setup() };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("TaskFormDialog — criação", () => {
  it("valida o título vazio sem chamar a API", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/título/i), "   ");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(await screen.findByText("Informe o título da tarefa")).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("se a API falhar, mantém o texto digitado e permite tentar novamente", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockImplementationOnce(() => json(201, { task: { ...savedTask, title: "Minha tarefa" } }));
    const { user, onOpenChange } = setup();

    await user.type(screen.getByLabelText(/título/i), "Minha tarefa");
    await user.type(screen.getByLabelText(/descrição/i), "Texto importante");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível salvar/i);
    expect(screen.getByLabelText(/título/i)).toHaveValue("Minha tarefa");
    expect(screen.getByLabelText(/descrição/i)).toHaveValue("Texto importante");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("impede envio duplicado por clique repetido", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolve = r)));
    const { user } = setup();

    await user.type(screen.getByLabelText(/título/i), "Uma vez só");
    const submit = screen.getByRole("button", { name: "Criar tarefa" });
    await user.click(submit);
    await user.click(submit);
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: /salvando/i })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ task: savedTask }), { status: 201 }));
  });

  it("mostra erros de validação do servidor junto ao campo", async () => {
    fetchMock.mockImplementationOnce(() =>
      json(422, { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { title: ["Título já usado"] } } }),
    );
    const { user } = setup();
    await user.type(screen.getByLabelText(/título/i), "Repetida");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(await screen.findByText("Título já usado")).toBeInTheDocument();
  });
});

describe("TaskFormDialog — edição", () => {
  it("preenche os campos e envia somente o que mudou (PATCH parcial)", async () => {
    fetchMock.mockImplementationOnce(() => json(200, { task: { ...savedTask, title: "Novo título" } }));
    const { user, onOpenChange } = setup({ task: savedTask });

    const title = screen.getByLabelText(/título/i);
    expect(title).toHaveValue("Revisar proposta");
    expect(screen.getByLabelText(/descrição/i)).toHaveValue("Conferir valores");

    await user.clear(title);
    await user.type(title, "Novo título");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/tarefas/${savedTask.id}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Novo título" });
  });

  it("Cancelar fecha sem salvar", async () => {
    const { user, onOpenChange } = setup({ task: savedTask });
    await user.type(screen.getByLabelText(/título/i), " alterado");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
