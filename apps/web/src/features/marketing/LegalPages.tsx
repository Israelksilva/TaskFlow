import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Keyboard, LifeBuoy, MessageCircle } from "lucide-react";
import { FAQ } from "./content";
import { PublicLayout } from "./PublicLayout";

function Doc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Andamo`;
  }, [title]);
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-14 text-[15px] leading-relaxed sm:px-6 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        <header>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: {updated}</p>
        </header>
        {children}
      </article>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <Doc title="Política de privacidade" updated="25 de novembro de 2026">
      <p>Esta política explica quais dados pessoais o Andamo trata, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail e senha (armazenada apenas como hash bcrypt). No login com Google, recebemos nome, e-mail e foto da conta Google.</li>
        <li>Conteúdo que você cria: workspaces, projetos, tarefas, comentários e preferências.</li>
        <li>Segurança: endereço IP e navegador das sessões ativas, registros de auditoria de ações sensíveis.</li>
        <li>Notificações push: o endereço técnico de inscrição fornecido pelo seu navegador.</li>
        <li>Formulário de contato: nome, e-mail e a mensagem enviada.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço (execução de contrato) e manter sua conta segura (legítimo interesse).</li>
        <li>Enviar notificações e e-mails transacionais que você configurou.</li>
        <li>Responder contatos e solicitações de suporte.</li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos seu conteúdo para publicidade.</p>
      <h2>3. Compartilhamento</h2>
      <p>Utilizamos fornecedores de infraestrutura para hospedagem do banco de dados e da aplicação, envio de e-mails e entrega de notificações push pelos serviços do seu navegador. Eles tratam dados apenas para operar o Andamo.</p>
      <h2>4. Retenção</h2>
      <p>Mantemos os dados enquanto a conta existir. Sessões encerradas e tokens expirados são apagados automaticamente; registros técnicos de entrega são mantidos por até 90 dias.</p>
      <h2>5. Seus direitos</h2>
      <ul>
        <li>Acessar e exportar seus dados em Configurações → Dados e privacidade.</li>
        <li>Corrigir seus dados de perfil a qualquer momento.</li>
        <li>Excluir sua conta, com remoção dos workspaces pessoais e anonimização do que você criou em workspaces compartilhados.</li>
        <li>Revogar consentimentos, como notificações push e e-mails, nas preferências.</li>
      </ul>
      <h2>6. Segurança</h2>
      <p>Usamos conexões HTTPS, tokens de sessão de curta duração com renovação segura, verificação em duas etapas opcional, isolamento de dados por workspace e registro de ações sensíveis.</p>
      <h2>7. Contato</h2>
      <p>Para exercer seus direitos ou tirar dúvidas, use o <Link to="/#contato" className="text-primary underline">formulário de contato</Link>.</p>
    </Doc>
  );
}

export function TermsPage() {
  return (
    <Doc title="Termos de uso" updated="25 de novembro de 2026">
      <p>Ao criar uma conta ou usar o Andamo, você concorda com estes termos.</p>
      <h2>1. O serviço</h2>
      <p>O Andamo é uma plataforma de gestão de projetos, tarefas e equipes, oferecida em planos gratuitos e pagos, cujas características e limites estão descritos na página de preços.</p>
      <h2>2. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em sigilo e pelas atividades da sua conta.</li>
        <li>Informe dados verdadeiros e mantenha seu e-mail atualizado.</li>
      </ul>
      <h2>3. Conteúdo</h2>
      <p>O conteúdo que você cria é seu. Você nos autoriza a armazená-lo e processá-lo apenas para prestar o serviço. Os administradores de cada workspace controlam quem tem acesso ao seu conteúdo.</p>
      <h2>4. Uso aceitável</h2>
      <ul>
        <li>Não use o Andamo para atividades ilegais, envio de spam ou para comprometer a segurança da plataforma ou de terceiros.</li>
        <li>Não tente acessar dados de workspaces dos quais você não é membro.</li>
      </ul>
      <h2>5. Planos pagos</h2>
      <p>Os valores vigentes estão na página de preços. Mudanças de preço serão comunicadas com antecedência. A contratação online ainda não está disponível; condições comerciais serão informadas no momento da contratação.</p>
      <h2>6. Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros.</p>
      <h2>7. Encerramento</h2>
      <p>Você pode excluir sua conta a qualquer momento nas configurações. Podemos suspender contas que violem estes termos.</p>
      <h2>8. Legislação</h2>
      <p>Estes termos são regidos pelas leis brasileiras.</p>
    </Doc>
  );
}

const GUIDES = [
  { title: "Primeiros passos", items: ["Crie um projeto em Projetos → Novo projeto.", "Adicione tarefas pelo botão “+” no topo ou pela tecla N.", "Arraste as tarefas entre A Fazer, Em Progresso e Concluído."] },
  { title: "Trabalhando em equipe", items: ["Crie um workspace de equipe no seletor do menu lateral.", "Convide pessoas em Equipe → Convidar, escolhendo o papel de cada uma.", "Mencione colegas nos comentários digitando @."] },
  { title: "Notificações e lembretes", items: ["Ajuste canais e categorias em Configurações → Notificações.", "Ative o push neste dispositivo para receber avisos com o app fechado.", "Defina horário silencioso ou use “Não perturbe”."] },
  { title: "Segurança da conta", items: ["Ative a verificação em duas etapas em Configurações → Segurança.", "Encerre sessões de dispositivos que você não reconhece.", "Exporte seus dados quando quiser em Dados e privacidade."] },
];

export function HelpPage() {
  useEffect(() => {
    document.title = "Central de ajuda · Andamo";
  }, []);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-14 sm:px-6">
        <header className="text-center">
          <LifeBuoy className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Central de ajuda</h1>
          <p className="mt-2 text-muted-foreground">Tutoriais rápidos e respostas para as dúvidas mais comuns.</p>
        </header>
        <section aria-labelledby="guides-h">
          <h2 id="guides-h" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold"><BookOpen className="h-5 w-5" /> Tutoriais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <article key={g.title} className="rounded-xl border bg-card p-5 shadow-card">
                <h3 className="font-semibold">{g.title}</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{g.items.map((i) => <li key={i}>{i}</li>)}</ol>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="keys-h">
          <h2 id="keys-h" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold"><Keyboard className="h-5 w-5" /> Atalhos de teclado</h2>
          <div className="grid gap-2 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
            {[["Ctrl K", "Buscar e comandos"], ["N", "Nova tarefa"], ["/", "Buscar no quadro"], ["Ctrl Enter", "Enviar comentário / salvar"], ["Esc", "Fechar painéis"], ["Ctrl B / Ctrl I", "Negrito / itálico no editor"]].map(([k, d]) => (
              <p key={k} className="flex items-center justify-between gap-4"><span>{d}</span><kbd>{k}</kbd></p>
            ))}
          </div>
        </section>
        <section aria-labelledby="faq-h">
          <h2 id="faq-h" className="mb-4 font-display text-2xl font-bold">Perguntas frequentes</h2>
          <dl className="space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-xl border bg-card p-5"><dt className="font-semibold">{f.q}</dt><dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd></div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl border bg-primary/5 p-6 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-2 font-display text-xl font-bold">Não encontrou o que procurava?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Envie sua dúvida, sugestão ou relato de erro pelo formulário de contato.</p>
          <Link to="/#contato" className="mt-4 inline-block font-medium text-primary hover:underline">Falar com o suporte →</Link>
        </section>
      </div>
    </PublicLayout>
  );
}
