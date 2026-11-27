import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PASSWORD_STRENGTH_LABELS, passwordStrength } from "@andamo/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Valor atual para o medidor de força (só em campos de senha nova). */
  strengthOf?: string;
  /** Palavras que não deveriam estar na senha (nome, e-mail). */
  strengthContext?: string[];
}

const BAR_COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

/** Campo de senha com botão mostrar/ocultar e medidor de força opcional. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, hint, id, className, strengthOf, strengthContext, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const strengthId = `${inputId}-strength`;
    const [visible, setVisible] = useState(false);
    const showMeter = strengthOf !== undefined && strengthOf.length > 0;
    const score = showMeter ? passwordStrength(strengthOf, strengthContext) : 0;
    const describedBy =
      [hint && !error && hintId, error && errorId, showMeter && strengthId]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "pr-11",
              error && "border-destructive focus-visible:ring-destructive",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls={inputId}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">{visible ? "Ocultar senha" : "Mostrar senha"}</span>
          </button>
        </div>
        {showMeter && (
          <div id={strengthId} className="flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full bg-muted transition-colors",
                    i < Math.max(score, 1) && BAR_COLORS[score],
                  )}
                />
              ))}
            </div>
            <span className="w-24 text-right text-xs text-muted-foreground">
              Força: {PASSWORD_STRENGTH_LABELS[score]}
            </span>
          </div>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
