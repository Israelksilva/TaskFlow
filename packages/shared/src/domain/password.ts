/**
 * Força da senha para o indicador do formulário (orientação ao usuário).
 * A regra que bloqueia é o `passwordSchema`; aqui só pontuamos de 0 a 4.
 */

const COMMON = [
  "123456", "12345678", "123456789", "password", "senha", "senha123", "qwerty", "abc123", "111111",
  "123123", "admin", "iloveyou", "brasil", "andamo", "teste", "mudar123", "000000", "654321",
];

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  0: "Muito fraca",
  1: "Fraca",
  2: "Razoável",
  3: "Boa",
  4: "Forte",
};

export function passwordStrength(password: string, context: string[] = []): PasswordStrength {
  if (!password) return 0;
  const lower = password.toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) && password.length < 12) return 0;
  if (context.some((c) => c.length >= 3 && lower.includes(c.toLowerCase()))) return 1;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const unique = new Set(password).size;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (classes >= 3) score += 1;
  if (classes === 4) score += 1;
  if (unique < password.length / 2) score -= 1;
  if (/^(.)\1+$/.test(password)) score = 0;
  return Math.max(0, Math.min(4, score)) as PasswordStrength;
}
