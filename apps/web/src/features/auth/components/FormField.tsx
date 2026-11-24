import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

/** Campo com rótulo, dica e erro ligados por aria-describedby. */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(error && "border-destructive focus-visible:ring-destructive", className)}
          {...props}
        />
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
FormField.displayName = "FormField";
