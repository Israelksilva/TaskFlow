import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderKanban, Loader2, MailCheck, Rocket, Users } from "lucide-react";
import { passwordSchema, ROLE_LABELS } from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { LoadingScreen } from "@/components/feedback/LoadingScreen";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspacesApi } from "@/features/workspaces/api";
import { wsKeys } from "@/features/workspaces/hooks";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { authApi } from "../api";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordStrengthMeter } from "../components/PasswordStrength";
import { useAuth } from "../use-auth";

/** "Esqueci minha senha": resposta sempre igual (não revela se o e-mail tem conta). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => authApi.forgotPassword(email) });
  return (
    <AuthLayout title="Recuperar senha" description="Enviaremos um link para você criar uma nova senha." footer={<Link to="/entrar" className="font-medium text-primary hover:underline">Voltar para o login</Link>}>
      {send.isSuccess ? (
        <div className="flex gap-3 rounded-lg bg-success/10 p-4 text-sm">
          <MailCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
          <p>Se houver uma conta com <strong>{email}</strong>, você receberá o link em instantes. Confira também a caixa de spam.</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), email && send.mutate())}>
          <div className="space-y-1.5"><Label htmlFor="fp-email">E-mail</Label><Input id="fp-email" type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {send.isError && <InlineError>{getErrorMessage(send.error)}</InlineError>}
          <Button type="submit" className="w-full" disabled={!email || send.isPending}>{send.isPending && <Loader2 className="animate-spin" />} Enviar link</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const valid = passwordSchema.safeParse(password);
  const reset = useMutation({ mutationFn: () => authApi.resetPassword(token, password) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid.success && password === confirm) reset.mutate();
  };
  return (
    <AuthLayout title="Nova senha" description="Escolha uma senha forte. Por segurança, todas as sessões serão encerradas." footer={<Link to="/entrar" className="font-medium text-primary hover:underline">Ir para o login</Link>}>
      {!token ? (
        <InlineError>Link inválido. Peça um novo em “Esqueci minha senha”.</InlineError>
      ) : reset.isSuccess ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" /> Senha redefinida com sucesso.</p>
          <Button asChild className="w-full"><Link to="/entrar">Entrar com a nova senha</Link></Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="rp-pw">Nova senha</Label>
            <Input id="rp-pw" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrengthMeter password={password} />
            {password && !valid.success && <p className="text-xs text-destructive">{valid.error.issues[0].message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirmar senha</Label>
            <Input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm && confirm !== password && <p className="text-xs text-destructive">As senhas não conferem</p>}
          </div>
          {reset.isError && <InlineError>{getErrorMessage(reset.error)}</InlineError>}
          <Button type="submit" className="w-full" disabled={!valid.success || password !== confirm || reset.isPending}>{reset.isPending && <Loader2 className="animate-spin" />} Salvar nova senha</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const qc = useQueryClient();
  const { status } = useAuth();
  const ran = useRef(false);
  const verify = useMutation({ mutationFn: () => authApi.verifyEmail(token), onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "me"] }) });
  useEffect(() => {
    if (token && !ran.current) {
      ran.current = true;
      verify.mutate();
    }
  }, [token, verify]);
  return (
    <AuthLayout title="Confirmação de e-mail" description="Validando seu link…" footer={<Link to={status === "authenticated" ? "/app" : "/entrar"} className="font-medium text-primary hover:underline">Continuar</Link>}>
      {verify.isPending && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</p>}
      {verify.isSuccess && <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" /> E-mail confirmado. Obrigado!</p>}
      {(verify.isError || !token) && <InlineError>{token ? getErrorMessage(verify.error) : "Link inválido."}</InlineError>}
    </AuthLayout>
  );
}

/** Convite: pré-visualiza e aceita (exige login com o e-mail convidado). */
export function InvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { status, user, logout } = useAuth();
  const preview = useQuery({ queryKey: ["invitation", token], queryFn: () => workspacesApi.previewInvitation(token), enabled: Boolean(token) && status === "authenticated", retry: false });
  const accept = useMutation({
    mutationFn: () => workspacesApi.acceptInvitation(token),
    onSuccess: (ws) => {
      void qc.invalidateQueries({ queryKey: wsKeys.all });
      navigate(`/app/w/${ws.id}`);
    },
  });
  if (status === "loading") return <LoadingScreen />;
  if (status !== "authenticated") return <Navigate to="/entrar" replace state={{ from: `/convite?token=${token}` }} />;
  if (user && !user.onboarded) return <Navigate to={`/boas-vindas?convite=${encodeURIComponent(token)}`} replace />;
  const inv = preview.data;
  return (
    <AuthLayout title="Convite para colaborar" description="Junte-se a um workspace no Andamo." footer={<Link to="/app" className="font-medium text-primary hover:underline">Ir para o app</Link>}>
      {preview.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : preview.isError || !inv ? (
        <InlineError>{getErrorMessage(preview.error ?? new Error("Convite não encontrado"))}</InlineError>
      ) : inv.expired ? (
        <InlineError>Este convite expirou ou já foi usado. Peça um novo a quem convidou você.</InlineError>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{inv.inviterName ?? "Alguém"} convidou <strong>{inv.email}</strong> para</p>
            <p className="mt-1 font-display text-xl font-bold">{inv.workspaceName}</p>
            <p className="mt-1 text-sm">Papel: {ROLE_LABELS[inv.role]}</p>
          </div>
          {user && user.email.toLowerCase() !== inv.email.toLowerCase() && (
            <InlineError>
              Você está conectado como {user.email}. <button className="underline" onClick={() => void logout()}>Sair e entrar com {inv.email}</button>
            </InlineError>
          )}
          {accept.isError && <InlineError>{getErrorMessage(accept.error)}</InlineError>}
          <Button className="w-full" disabled={accept.isPending || user?.email.toLowerCase() !== inv.email.toLowerCase()} onClick={() => accept.mutate()}>
            {accept.isPending && <Loader2 className="animate-spin" />} Aceitar convite
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}

/** Onboarding de novos usuários: escolha entre uso individual ou criar um workspace de equipe. */
export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invite = params.get("convite");
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [teamName, setTeamName] = useState("");
  const finish = useMutation({
    mutationFn: async () => {
      const ws = mode === "team" && teamName.trim().length >= 2 ? await workspacesApi.create(teamName.trim()) : null;
      const u = await authApi.completeOnboarding();
      return { u, ws };
    },
    onSuccess: ({ u, ws }) => {
      setUser(u);
      void qc.invalidateQueries({ queryKey: wsKeys.all });
      navigate(invite ? `/convite?token=${encodeURIComponent(invite)}` : ws ? `/app/w/${ws.id}/equipe` : "/app");
    },
  });
  if (user?.onboarded && !invite) return <Navigate to="/app" replace />;

  const option = (id: "solo" | "team", Icon: typeof Rocket, title: string, text: string) => (
    <button onClick={() => setMode(id)} aria-pressed={mode === id} className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/50", mode === id && "border-primary bg-primary/5 ring-1 ring-primary")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      <span><span className="block font-semibold">{title}</span><span className="text-sm text-muted-foreground">{text}</span></span>
    </button>
  );

  return (
    <div className="bg-brand-glow flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border bg-card p-6 shadow-elevated sm:p-8">
        <Logo />
        <div>
          <h1 className="font-display text-2xl font-extrabold">Boas-vindas, {user?.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu espaço pessoal já está pronto, com o projeto “Minhas tarefas”. Como você vai usar o Andamo?</p>
        </div>
        {invite ? (
          <p className="rounded-lg bg-primary/5 p-3 text-sm">Você tem um convite pendente — vamos abri-lo em seguida.</p>
        ) : (
          <div className="grid gap-3">
            {option("solo", FolderKanban, "Para mim", "Organizar meus projetos e tarefas pessoais.")}
            {option("team", Users, "Com minha equipe", "Criar um workspace para convidar pessoas e dividir o trabalho.")}
          </div>
        )}
        {mode === "team" && !invite && (
          <div className="space-y-1.5"><Label htmlFor="ob-team">Nome da equipe ou empresa</Label><Input id="ob-team" autoFocus maxLength={80} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex.: Studio Aurora" /></div>
        )}
        {finish.isError && <InlineError>{getErrorMessage(finish.error)}</InlineError>}
        <Button className="w-full bg-brand text-white hover:brightness-110" disabled={finish.isPending || (mode === "team" && !invite && teamName.trim().length < 2)} onClick={() => finish.mutate()}>
          {finish.isPending ? <Loader2 className="animate-spin" /> : <Rocket />} Começar
        </Button>
        <p className="text-center text-xs text-muted-foreground">Dica: pressione <kbd>Ctrl</kbd> <kbd>K</kbd> em qualquer tela para buscar e executar comandos.</p>
      </div>
    </div>
  );
}
