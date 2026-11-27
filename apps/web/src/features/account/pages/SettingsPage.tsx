import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/use-auth";
import { PasswordSection } from "../components/PasswordSection";
import { ProfileSection } from "../components/ProfileSection";
import { EmailSection, GoogleSection } from "../components/SecuritySection";
import { SessionsSection } from "../components/SessionsSection";
import { TwoFactorSection } from "../components/TwoFactorSection";

const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "seguranca", label: "Segurança" },
  { value: "sessoes", label: "Sessões" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const GOOGLE_RESULTS: Record<string, () => void> = {
  vinculado: () => toast.success("Conta Google conectada."),
  em_uso: () => toast.error("Esta conta Google já está ligada a outro usuário do Andamo."),
  cancelado: () => toast.info("Conexão com o Google cancelada."),
  expirado: () => toast.error("A conexão com o Google demorou demais. Tente de novo."),
  falha: () => toast.error("Não foi possível conectar o Google. Tente de novo."),
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("aba");
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "perfil";

  // Resultado da volta do Google (?google=…): avisa uma vez e limpa a URL.
  useEffect(() => {
    const result = params.get("google");
    if (!result) return;
    GOOGLE_RESULTS[result]?.();
    const next = new URLSearchParams(params);
    next.delete("google");
    setParams(next, { replace: true });
  }, [params, setParams]);

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua conta, segurança e preferências.</p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setParams({ aba: value }, { replace: true })}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="perfil" className="mt-6">
          <ProfileSection user={user} />
        </TabsContent>
        <TabsContent value="seguranca" className="mt-6 space-y-6">
          <PasswordSection key={String(user.hasPassword)} user={user} />
          <TwoFactorSection user={user} />
          <EmailSection user={user} />
          <GoogleSection user={user} />
        </TabsContent>
        <TabsContent value="sessoes" className="mt-6">
          <SessionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
