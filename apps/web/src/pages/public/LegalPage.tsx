import { useEffect, type ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PublicLayout } from "./PublicLayout";

/**
 * Política de Privacidade e Termos de Uso.
 * RASCUNHOS: descrevem fielmente o que o sistema faz hoje, mas precisam de revisão jurídica
 * antes de valerem como documento definitivo. Atualize junto com qualquer mudança no tratamento de dados.
 */

const UPDATED_AT = "25 de novembro de 2026";

type Doc = "privacidade" | "termos";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

const contactLink = (
  <Link
    to="/"
    state={{ scrollTo: "contato" }}
    className="font-medium text-primary underline underline-offset-4"
  >
    formulário de contato
  </Link>
);

function Privacy() {
  return (
    <>
      <Section title="1. Quem somos">
        <p>
          O Andamo é um aplicativo web de gestão de tarefas desenvolvido e mantido por Israel
          Alcantara, que atua como controlador dos dados pessoais tratados no serviço, nos termos da
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
      </Section>
      <Section title="2. Quais dados coletamos">
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail e senha. A senha é armazenada apenas como hash
            bcrypt — nunca em texto.
          </li>
          <li>
            <strong>Conteúdo:</strong> as tarefas que você cria (título, descrição, prioridade,
            prazo, status e ordem).
          </li>
          <li>
            <strong>Formulário de contato:</strong> nome, e-mail, assunto e mensagem que você
            enviar.
          </li>
          <li>
            <strong>Registros técnicos:</strong> endereço IP, navegador, rota acessada, horário e
            código de resposta de cada requisição à API, usados para segurança e diagnóstico. Senhas
            e tokens não são registrados.
          </li>
          <li>
            <strong>No seu navegador:</strong> o token de sessão, sua preferência de tema e o estado
            do menu lateral ficam no armazenamento local do navegador. Não usamos cookies de
            rastreamento, publicidade ou ferramentas de análise de terceiros.
          </li>
        </ul>
      </Section>
      <Section title="3. Para que usamos e com qual base legal">
        <ul>
          <li>Criar e manter sua conta e suas tarefas — execução do contrato (art. 7º, V).</li>
          <li>
            Responder às mensagens de contato — execução de procedimentos preliminares e
            consentimento (art. 7º, I e V).
          </li>
          <li>
            Proteger o serviço contra abuso, fraude e falhas — legítimo interesse (art. 7º, IX).
          </li>
        </ul>
        <p>Não vendemos dados pessoais e não os usamos para publicidade.</p>
      </Section>
      <Section title="4. Com quem compartilhamos">
        <p>Apenas com provedores de infraestrutura necessários para o serviço funcionar:</p>
        <ul>
          <li>
            <strong>Neon</strong> — banco de dados PostgreSQL onde ficam contas, tarefas e
            mensagens.
          </li>
          <li>
            <strong>Render</strong> — hospedagem da API.
          </li>
          <li>
            <strong>GitHub Pages</strong> — hospedagem do site e do aplicativo (recebe o IP de quem
            acessa as páginas).
          </li>
        </ul>
        <p>
          Esses provedores podem processar dados fora do Brasil; a transferência ocorre para a
          prestação do serviço (art. 33 da LGPD). Também poderemos compartilhar dados quando exigido
          por lei ou ordem judicial.
        </p>
      </Section>
      <Section title="5. Por quanto tempo guardamos">
        <ul>
          <li>Dados da conta e tarefas: enquanto a conta existir.</li>
          <li>Mensagens de contato: pelo tempo necessário para tratar o pedido.</li>
          <li>Registros técnicos: pelo período de retenção dos provedores de hospedagem.</li>
        </ul>
      </Section>
      <Section title="6. Seus direitos">
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção, portabilidade, eliminação dos
          dados e informação sobre compartilhamento, além de revogar consentimentos (art. 18 da
          LGPD). Envie o pedido pelo {contactLink} com o assunto “Privacidade e dados pessoais”,
          usando o e-mail da sua conta. Você também pode reclamar à Autoridade Nacional de Proteção
          de Dados (ANPD).
        </p>
      </Section>
      <Section title="7. Segurança">
        <p>
          Comunicação criptografada (HTTPS), senhas com hash, isolamento dos dados por conta,
          limitação de tentativas de acesso e cabeçalhos de segurança. Nenhum sistema é totalmente
          invulnerável; se houver um incidente que gere risco relevante, avisaremos os afetados e a
          ANPD.
        </p>
      </Section>
      <Section title="8. Crianças e adolescentes">
        <p>O Andamo não é direcionado a menores de 18 anos.</p>
      </Section>
      <Section title="9. Alterações">
        <p>
          Esta política pode mudar com a evolução do produto. A data de atualização fica no topo da
          página e mudanças relevantes serão avisadas no aplicativo.
        </p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <Section title="1. Aceitação">
        <p>
          Ao criar uma conta ou usar o Andamo, você concorda com estes Termos e com a{" "}
          <Link to="/privacidade" className="font-medium text-primary underline underline-offset-4">
            Política de Privacidade
          </Link>
          . Se não concordar, não utilize o serviço.
        </p>
      </Section>
      <Section title="2. O serviço">
        <p>
          O Andamo é um aplicativo de organização de tarefas em quadro Kanban, oferecido hoje
          gratuitamente. Recursos marcados como “em desenvolvimento” ou “em breve” ainda não estão
          disponíveis e podem mudar ou não ser lançados.
        </p>
      </Section>
      <Section title="3. Sua conta">
        <ul>
          <li>Você deve ter pelo menos 18 anos e informar dados verdadeiros.</li>
          <li>
            Você é responsável por manter sua senha em sigilo e pelas ações feitas com sua conta.
          </li>
          <li>Avise-nos pelo {contactLink} se suspeitar de uso indevido.</li>
        </ul>
      </Section>
      <Section title="4. Uso aceitável">
        <p>Não é permitido:</p>
        <ul>
          <li>usar o serviço para atividades ilegais ou para armazenar conteúdo ilícito;</li>
          <li>tentar acessar contas ou dados de outras pessoas;</li>
          <li>
            sobrecarregar, testar vulnerabilidades sem autorização ou interferir no funcionamento do
            serviço;
          </li>
          <li>automatizar o cadastro de contas ou o envio de mensagens.</li>
        </ul>
        <p>Podemos suspender contas que violem estas regras.</p>
      </Section>
      <Section title="5. Seu conteúdo">
        <p>
          As tarefas que você cria são suas. Você nos autoriza apenas a armazená-las e processá-las
          para prestar o serviço.
        </p>
      </Section>
      <Section title="6. Planos e cobranças">
        <p>
          Hoje não há cobrança. Quando planos pagos forem lançados, preços e condições serão
          apresentados antes da contratação, e nenhuma cobrança será feita sem a sua confirmação.
        </p>
      </Section>
      <Section title="7. Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter o serviço estável e seguro, mas ele é oferecido “no estado em que
          se encontra”, sem garantia de funcionamento ininterrupto. Mantenha cópias de informações
          críticas. Nada nestes Termos limita direitos garantidos pelo Código de Defesa do
          Consumidor.
        </p>
      </Section>
      <Section title="8. Encerramento">
        <p>
          Você pode deixar de usar o serviço e pedir a exclusão da conta a qualquer momento pelo{" "}
          {contactLink}.
        </p>
      </Section>
      <Section title="9. Alterações e foro">
        <p>
          Podemos atualizar estes Termos; mudanças relevantes serão avisadas no aplicativo.
          Aplica-se a legislação brasileira, ficando eleito o foro do domicílio do usuário.
        </p>
      </Section>
    </>
  );
}

const DOCS: Record<Doc, { title: string; description: string; Body: () => JSX.Element }> = {
  privacidade: {
    title: "Política de Privacidade",
    description: "Como o Andamo coleta, usa e protege seus dados pessoais.",
    Body: Privacy,
  },
  termos: {
    title: "Termos de Uso",
    description: "As regras para usar o Andamo.",
    Body: Terms,
  },
};

export default function LegalPage({ doc }: { doc: Doc }) {
  const { title, description, Body } = DOCS[doc];

  useEffect(() => {
    document.title = `${title} — Andamo`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Breadcrumb items={[{ label: "Início", to: "/" }, { label: title }]} />
        <header className="mt-6 space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>
        </header>
        <div
          role="note"
          className="mt-8 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground"
        >
          <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p>
            <strong>Rascunho em revisão jurídica.</strong> Este texto descreve fielmente como o
            Andamo funciona hoje, mas ainda será revisado por um profissional antes da versão
            definitiva.
          </p>
        </div>
        <div className="mt-10 space-y-10">
          <Body />
        </div>
      </article>
    </PublicLayout>
  );
}
