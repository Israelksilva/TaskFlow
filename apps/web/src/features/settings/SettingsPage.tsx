import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import QRCode from "qrcode";
import { Bell, Download, KeyRound, Loader2, LogOut, Monitor, Moon, Palette, Shield, Smartphone, Sun, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  REMINDER_OFFSETS,
  type NotificationPreferences,
  type NotificationPreferencesInput,
} from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { useCrumbs } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { authApi } from "@/features/auth/api";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrength";
import { useAuth } from "@/features/auth/use-auth";
import { notificationsApi } from "@/features/notifications/api";
import { notificationKeys, useNotificationPreferences } from "@/features/notifications/hooks";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/features/notifications/push";
import { getErrorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "dados", label: "Dados e privacidade", icon: Download },
] as const;

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "America/Belem", "America/Cuiaba", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "UTC"];

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="font-display font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const onErr = (e: unknown) => toast.error(getErrorMessage(e));

// ---------------------------------------------------------------- perfil
function ProfileSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user!.name);
  const [avatarUrl, setAvatarUrl] = useState(user!.avatarUrl ?? "");
  const [timezone, setTimezone] = useState(user!.timezone);
  const [locale, setLocale] = useState(user!.locale);
  const save = useMutation({
    mutationFn: () => authApi.updateProfile({ name, avatarUrl: avatarUrl || null, timezone, locale: locale as "pt-BR" }),
    onSuccess: (u) => (setUser(u), toast.success("Perfil atualizado")),
    onError: onErr,
  });
  const resend = useMutation({ mutationFn: authApi.resendVerification, onSuccess: () => toast.success("E-mail de confirmação reenviado"), onError: onErr });
  return (
    <Card title="Perfil" description="Como as outras pessoas veem você no Andamo.">
      <div className="flex items-center gap-4">
        <UserAvatar user={{ id: user!.id, name, avatarUrl: avatarUrl || null }} className="h-16 w-16 text-lg ring-0" />
        <div className="text-sm">
          <p className="font-medium">{user!.email}</p>
          {user!.emailVerified ? (
            <p className="text-success">E-mail confirmado</p>
          ) : (
            <p className="text-warning">
              E-mail não confirmado ·{" "}
              <button className="font-medium underline" disabled={resend.isPending} onClick={() => resend.mutate()}>reenviar confirmação</button>
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="p-name">Nome</Label><Input id="p-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-avatar">Foto (URL https)</Label><Input id="p-avatar" placeholder="https://…" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Fuso horário</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger aria-label="Fuso horário"><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([timezone, ...TIMEZONES])].map((tz) => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Idioma</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger aria-label="Idioma"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="pt-BR">Português (Brasil)</SelectItem></SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Outros idiomas estão no roadmap.</p>
        </div>
      </div>
      <Button disabled={save.isPending || name.trim().length < 2} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="animate-spin" />} Salvar</Button>
    </Card>
  );
}

// ---------------------------------------------------------------- segurança
function TwoFactorCard() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const start = useMutation({
    mutationFn: authApi.setupTwoFactor,
    onSuccess: async (s) => setSetup({ ...s, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 200 }) }),
    onError: onErr,
  });
  const enable = useMutation({ mutationFn: () => authApi.enableTwoFactor(code), onSuccess: (u) => (setUser(u), setSetup(null), setCode(""), toast.success("Verificação em duas etapas ativada")), onError: onErr });
  const disable = useMutation({ mutationFn: () => authApi.disableTwoFactor(code), onSuccess: (u) => (setUser(u), setCode(""), toast.success("Verificação em duas etapas desativada")), onError: onErr });

  return (
    <Card title="Verificação em duas etapas" description="Além da senha, peça um código do seu aplicativo autenticador (Google Authenticator, Authy, 1Password…).">
      {user!.twoFactorEnabled ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-success"><Smartphone className="h-4 w-4" /> Ativada</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="Código de 6 dígitos" className="sm:w-48" aria-label="Código para desativar" />
            <Button variant="outline" disabled={code.length !== 6 || disable.isPending} onClick={() => disable.mutate()}>Desativar</Button>
          </div>
        </div>
      ) : setup ? (
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <img src={setup.qr} alt="QR code para configurar o aplicativo autenticador" className="h-[200px] w-[200px] rounded-lg bg-white p-2" />
          <div className="space-y-3 text-sm">
            <p>1. Escaneie o QR code no aplicativo autenticador.</p>
            <p>Sem câmera? Digite a chave: <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{setup.secret}</code></p>
            <p>2. Informe o código gerado:</p>
            <div className="flex gap-2">
              <Input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-32 font-mono" aria-label="Código do autenticador" />
              <Button disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>Ativar</Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" disabled={start.isPending} onClick={() => start.mutate()}><KeyRound /> Configurar</Button>
      )}
    </Card>
  );
}

function SecuritySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: authApi.sessions });
  const refresh = () => qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
  const change = useMutation({
    mutationFn: () => authApi.changePassword(user!.hasPassword ? current : undefined, next),
    onSuccess: () => (setCurrent(""), setNext(""), refresh(), toast.success("Senha alterada. Outras sessões foram encerradas.")),
    onError: onErr,
  });
  const revoke = useMutation({ mutationFn: authApi.revokeSession, onSuccess: refresh, onError: onErr });
  const revokeOthers = useMutation({ mutationFn: authApi.revokeOtherSessions, onSuccess: (r) => (refresh(), toast.success(`${r.revoked} sessão(ões) encerrada(s)`)), onError: onErr });

  const device = (ua: string | null) => {
    if (!ua) return "Dispositivo desconhecido";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
    const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    return `${browser}${os ? ` no ${os}` : ""}`;
  };

  return (
    <>
      <Card title={user!.hasPassword ? "Alterar senha" : "Definir senha"} description={user!.hasPassword ? "Ao trocar, as outras sessões são encerradas." : "Sua conta usa login com Google. Defina uma senha para entrar também por e-mail."}>
        <div className="grid gap-3 sm:grid-cols-2">
          {user!.hasPassword && (
            <div className="space-y-1.5"><Label htmlFor="cur-pw">Senha atual</Label><Input id="cur-pw" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">Nova senha</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <PasswordStrengthMeter password={next} />
          </div>
        </div>
        <Button disabled={next.length < 8 || change.isPending} onClick={() => change.mutate()}>{change.isPending && <Loader2 className="animate-spin" />} Salvar senha</Button>
      </Card>
      <TwoFactorCard />
      <Card title="Sessões ativas" description="Dispositivos conectados à sua conta.">
        {sessions.isPending ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.data?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{device(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Este dispositivo</span>}</p>
                  <p className="text-xs text-muted-foreground">Último uso {relativeTime(s.lastUsedAt)}{s.ip && ` · IP ${s.ip}`}</p>
                </div>
                {!s.current && <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Encerrar</Button>}
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" disabled={(sessions.data?.length ?? 0) < 2 || revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          <LogOut /> Encerrar todas as outras sessões
        </Button>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- notificações
function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"loading" | "on" | "off">("loading");
  useEffect(() => {
    void currentSubscription().then((s) => setState(s ? "on" : "off"));
  }, []);
  if (!pushSupported()) return <p className="text-sm text-muted-foreground">Este navegador não suporta notificações push. No iPhone, instale o Andamo na tela de início (iOS 16.4+).</p>;
  if (!vapidKey) return <p className="text-sm text-muted-foreground">As notificações push ainda não foram configuradas no servidor (chaves VAPID pendentes).</p>;
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return <p className="text-sm text-warning">As notificações estão bloqueadas para este site nas configurações do navegador.</p>;
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm">
        <p className="font-medium">Neste dispositivo</p>
        <p className="text-muted-foreground">Receba avisos mesmo com o Andamo fechado.</p>
      </div>
      <Button
        variant={state === "on" ? "outline" : "default"}
        disabled={state === "loading"}
        onClick={async () => {
          try {
            if (state === "on") {
              await disablePush();
              setState("off");
              toast.success("Push desativado neste dispositivo");
            } else {
              const r = await enablePush(vapidKey);
              if (r === "granted") {
                setState("on");
                toast.success("Push ativado neste dispositivo");
              } else toast.error("Permissão de notificação negada");
            }
          } catch (e) {
            onErr(e);
          }
        }}
      >
        {state === "on" ? "Desativar" : "Ativar push"}
      </Button>
    </div>
  );
}

function NotificationsSection() {
  const qc = useQueryClient();
  const prefs = useNotificationPreferences();
  const config = useQuery({ queryKey: ["config"], queryFn: authApi.config, staleTime: Infinity });
  const save = useMutation({
    mutationFn: (input: NotificationPreferencesInput) => notificationsApi.updatePreferences(input),
    onMutate: (input) => {
      const prev = qc.getQueryData<NotificationPreferences>(notificationKeys.prefs);
      if (prev) qc.setQueryData(notificationKeys.prefs, { ...prev, ...input });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.prefs, ctx.prev);
      onErr(e);
    },
    onSuccess: (p) => qc.setQueryData(notificationKeys.prefs, p),
  });
  const p = prefs.data;
  if (!p) return <Skeleton className="h-64 rounded-xl" />;
  const toggle = (key: "inApp" | "push" | "email" | "sound", label: string, hint: string) => (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm"><span className="block font-medium">{label}</span><span className="text-muted-foreground">{hint}</span></span>
      <Switch checked={p[key]} onCheckedChange={(v) => save.mutate({ [key]: v })} />
    </label>
  );
  const dndActive = p.dndUntil && new Date(p.dndUntil) > new Date();

  return (
    <>
      <Card title="Canais" description="Onde você quer ser avisado.">
        {toggle("inApp", "Na central do Andamo", "Sino, caixa de entrada e avisos na tela.")}
        {toggle("sound", "Som", "Toca um aviso curto quando chega uma notificação.")}
        {toggle("push", "Push", "Notificações do sistema no computador e no celular.")}
        {p.push && <PushToggle vapidKey={config.data?.vapidPublicKey ?? null} />}
        {toggle("email", "E-mail", "Atribuições, menções, lembretes e avisos importantes.")}
        {p.email && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Frequência dos e-mails</span>
            <Select value={p.emailDigest} onValueChange={(v) => save.mutate({ emailDigest: v as NotificationPreferences["emailDigest"] })}>
              <SelectTrigger className="w-48" aria-label="Frequência dos e-mails"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Na hora (só importantes)</SelectItem>
                <SelectItem value="daily">Resumo diário (8h)</SelectItem>
                <SelectItem value="weekly">Resumo semanal (segunda, 8h)</SelectItem>
                <SelectItem value="off">Nunca</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {config.data && !config.data.integrations.email && <p className="text-xs text-muted-foreground">Observação: o envio de e-mails ainda não foi configurado no servidor; por enquanto eles não são entregues.</p>}
      </Card>
      <Card title="Categorias" description="Desmarque o que não quer receber.">
        <div className="grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!p.mutedCategories.includes(c)}
                disabled={c === "system"}
                onCheckedChange={(v) => save.mutate({ mutedCategories: v ? p.mutedCategories.filter((x) => x !== c) : [...p.mutedCategories, c] })}
              />
              {NOTIFICATION_CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </Card>
      <Card title="Lembretes de prazo" description="Quando avisar antes do vencimento das tarefas atribuídas a você.">
        <div className="grid gap-2 sm:grid-cols-2">
          {REMINDER_OFFSETS.map((o) => (
            <label key={o.minutes} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={p.reminderOffsets.includes(o.minutes)}
                onCheckedChange={(v) => save.mutate({ reminderOffsets: v ? [...p.reminderOffsets, o.minutes] : p.reminderOffsets.filter((x) => x !== o.minutes) })}
              />
              {o.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Prazos sem horário consideram 18:00 no seu fuso. Lembretes já agendados são recalculados quando a tarefa muda.</p>
      </Card>
      <Card title="Horário silencioso e não perturbe" description="Push e e-mails imediatos ficam pausados; tudo continua registrado na caixa de entrada.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5"><Label htmlFor="q-start">Das</Label><Input id="q-start" type="time" className="w-32" defaultValue={p.quietStart ?? ""} onBlur={(e) => save.mutate({ quietStart: e.target.value || null })} /></div>
          <div className="space-y-1.5"><Label htmlFor="q-end">Até</Label><Input id="q-end" type="time" className="w-32" defaultValue={p.quietEnd ?? ""} onBlur={(e) => save.mutate({ quietEnd: e.target.value || null })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dndActive ? (
            <>
              <span className="text-sm">Não perturbe até {new Date(p.dndUntil!).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              <Button size="sm" variant="outline" onClick={() => save.mutate({ dndUntil: null })}>Encerrar</Button>
            </>
          ) : (
            [1, 4, 24].map((h) => (
              <Button key={h} size="sm" variant="outline" onClick={() => save.mutate({ dndUntil: new Date(Date.now() + h * 3600e3).toISOString() })}>
                Não perturbe por {h === 24 ? "1 dia" : `${h}h`}
              </Button>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- aparência
function AppearanceSection() {
  const { theme = "system", setTheme } = useTheme();
  const options = [
    { id: "light", label: "Claro", icon: Sun },
    { id: "dark", label: "Escuro", icon: Moon },
    { id: "system", label: "Automático", icon: Monitor },
  ];
  return (
    <Card title="Tema" description="Automático segue a configuração do seu sistema.">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.id} onClick={() => setTheme(o.id)} aria-pressed={theme === o.id} className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors hover:border-primary/50", theme === o.id && "border-primary bg-primary/5 ring-1 ring-primary")}>
            <o.icon className="h-5 w-5" aria-hidden /> {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- dados (LGPD)
function DataSection() {
  const { user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const exportData = useMutation({
    mutationFn: authApi.exportData,
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      Object.assign(document.createElement("a"), { href: url, download: "andamo-meus-dados.json" }).click();
      URL.revokeObjectURL(url);
    },
    onError: onErr,
  });
  const del = useMutation({ mutationFn: () => authApi.deleteAccount(user!.hasPassword ? password : undefined), onSuccess: () => void logout(), onError: onErr });
  return (
    <>
      <Card title="Exportar meus dados" description="Baixe uma cópia (JSON) dos seus dados pessoais, tarefas, comentários e notificações — direito de portabilidade da LGPD.">
        <Button variant="outline" disabled={exportData.isPending} onClick={() => exportData.mutate()}>{exportData.isPending ? <Loader2 className="animate-spin" /> : <Download />} Exportar</Button>
      </Card>
      <Card title="Excluir conta" description="Remove sua conta, seus workspaces pessoais e os dados associados. Tarefas que você criou em workspaces compartilhados permanecem para a equipe, sem o seu nome.">
        <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => setConfirmOpen(true)}><Trash2 /> Excluir minha conta</Button>
      </Card>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir sua conta?</DialogTitle>
            <DialogDescription>Esta ação é permanente. Se você é proprietário de um workspace com outras pessoas, transfira a propriedade antes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {user!.hasPassword && <div className="space-y-1.5"><Label htmlFor="del-pw">Senha</Label><Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label htmlFor="del-confirm">Digite EXCLUIR para confirmar</Label><Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} /></div>
            {del.isError && <InlineError>{getErrorMessage(del.error)}</InlineError>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={typed !== "EXCLUIR" || del.isPending} onClick={() => del.mutate()}>Excluir definitivamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SettingsPage() {
  const { secao = "perfil" } = useParams();
  const current = SECTIONS.find((s) => s.id === secao) ?? SECTIONS[0];
  useCrumbs([{ label: "Configurações", to: "/app/configuracoes" }, { label: current.label }]);
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_1fr] lg:py-8">
      <nav aria-label="Seções de configurações" className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.id}
            to={`/app/configuracoes/${s.id}`}
            className={() => cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", current.id === s.id && "bg-accent text-foreground")}
          >
            <s.icon className="h-4 w-4" aria-hidden /> {s.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 space-y-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{current.label}</h1>
        {current.id === "perfil" && <ProfileSection />}
        {current.id === "seguranca" && <SecuritySection />}
        {current.id === "notificacoes" && <NotificationsSection />}
        {current.id === "aparencia" && <AppearanceSection />}
        {current.id === "dados" && <DataSection />}
      </div>
    </div>
  );
}
