import { FormField } from "@/features/auth/components/FormField";

/** Campo de código do app autenticador (ou de recuperação, quando permitido). */
export function CodeInput({
  value,
  onChange,
  error,
  allowRecovery = false,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  allowRecovery?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <FormField
      label={allowRecovery ? "Código do app ou de recuperação" : "Código do app autenticador"}
      autoComplete="one-time-code"
      inputMode={allowRecovery ? "text" : "numeric"}
      placeholder={allowRecovery ? "000000 ou XXXXX-XXXXX" : "000000"}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
    />
  );
}
