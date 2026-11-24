/** Botão "Nova tarefa" visível no layout atual (desktop ou celular). */
export function getNewTaskButton(): HTMLElement | null {
  const buttons = document.querySelectorAll<HTMLElement>("[data-new-task-button]");
  return Array.from(buttons).find((b) => b.offsetParent !== null) ?? buttons[0] ?? null;
}

/** Devolve o foco ao elemento que abriu o modal ou, se ele sumiu, ao "Nova tarefa". */
export function restoreFocus(target: HTMLElement | null | undefined) {
  (target?.isConnected ? target : getNewTaskButton())?.focus();
}

/** Devolve o foco a um cartão após ele mudar de lugar (ex.: mover pelo menu). */
export function focusTaskCard(taskId: string) {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-task-id="${taskId}"] [data-card-focus]`)
      ?.focus();
  });
}
