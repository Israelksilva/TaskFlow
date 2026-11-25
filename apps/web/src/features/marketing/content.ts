/** Conteúdo institucional compartilhado entre landing e central de ajuda. */
export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "O Andamo é gratuito?",
    a: "Sim. O plano Free é gratuito para sempre, com até 5 membros e 3 projetos ativos. Os planos Pro e Business liberam mais pessoas, projetos e recursos avançados.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Andamo funciona no navegador do computador e do celular. Se preferir, instale como aplicativo (PWA) pelo menu do navegador para abrir em tela cheia e receber notificações.",
  },
  {
    q: "Como funcionam as notificações e os lembretes?",
    a: "Você recebe avisos quando alguém atribui uma tarefa, menciona você, comenta ou muda um prazo. Lembretes de prazo podem ser configurados (7 dias, 3 dias, 1 dia, 1 hora antes, no vencimento ou depois), na central, por push e por e-mail, respeitando seu horário silencioso.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Senhas são armazenadas com hash bcrypt, sessões usam tokens de curta duração com renovação segura e você pode ativar verificação em duas etapas. Cada workspace é isolado: só membros acessam seus dados. Você pode exportar ou excluir sua conta a qualquer momento.",
  },
  {
    q: "Posso convidar pessoas de fora da empresa?",
    a: "Sim. Além de membros, os planos pagos permitem convidados (que comentam e editam apenas as tarefas atribuídas a eles) e visualizadores (somente leitura).",
  },
  {
    q: "Posso migrar minhas tarefas da versão anterior?",
    a: "Sim. Se você usava a versão anterior do Andamo neste navegador, as tarefas salvas localmente podem ser importadas para sua conta com um clique.",
  },
];

export const APP_NAME = "Andamo";
export const CONTACT_FALLBACK = "Use o formulário de contato desta página.";
