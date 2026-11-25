import { passwordStrength } from "@andamo/shared";
import { cn } from "@/lib/utils";

const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success/80", "bg-success"];

/** Indicador de força calculado localmente (a senha nunca sai do navegador para isso). */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = passwordStrength(password);
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i < Math.max(1, s.score) && COLORS[s.score])} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Força: <span className="font-medium text-foreground">{s.label}</span>
        {s.suggestions.length > 0 && ` · ${s.suggestions[0]}`}
      </p>
    </div>
  );
}
