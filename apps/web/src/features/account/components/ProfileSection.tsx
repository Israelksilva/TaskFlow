import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { updateProfileSchema, type User } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineError } from "@/components/feedback/InlineError";
import { THEMES } from "@/components/layout/AccountMenu";
import { FormField } from "@/features/auth/components/FormField";
import { accountApi } from "@/features/auth/api";
import { useAuth } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { Section } from "./Section";

const LOCALE_LABELS: Record<string, string> = { "pt-BR": "Português (Brasil)" };

function timezones(current: string) {
  let list: string[] = [];
  try {
    list = Intl.supportedValuesOf("timeZone");
  } catch {
    /* navegador antigo: fica só o atual */
  }
  return list.includes(current) ? list : [current, ...list];
}

export function ProfileSection({ user }: { user: User }) {
  const { setUser } = useAuth();
  const { theme = "system", setTheme } = useTheme();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [nameError, setNameError] = useState<string>();
  const zones = useMemo(() => timezones(user.timezone), [user.timezone]);
  const dirty = name.trim() !== user.name || timezone !== user.timezone;

  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Perfil atualizado.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ name, timezone });
    if (!parsed.success) {
      setNameError(parsed.error.issues.find((i) => i.path[0] === "name")?.message);
      return;
    }
    setNameError(undefined);
    if (!save.isPending) save.mutate(parsed.data);
  }

  return (
    <div className="space-y-6">
      <Section title="Perfil" description="Como seu nome aparece no Andamo.">
        <form noValidate onSubmit={submit} className="space-y-4">
          <FormField
            label="Nome"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
          <FormField
            label="E-mail"
            value={user.email}
            readOnly
            disabled
            hint="A troca de e-mail chega em uma próxima versão."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="locale">Idioma</Label>
              <Select value={user.locale} disabled>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user.locale}>
                    {LOCALE_LABELS[user.locale] ?? user.locale}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Fuso horário</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {save.isError && <InlineError>{getErrorMessage(save.error)}</InlineError>}
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Salvar alterações
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Aparência" description="Vale para este navegador.">
        <div role="radiogroup" aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:border-primary aria-checked:bg-primary/5"
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
