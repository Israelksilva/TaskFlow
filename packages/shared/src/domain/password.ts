export interface PasswordStrength {
  /** 0 (muito fraca) a 4 (forte). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
}

const COMMON = ["123456", "password", "senha", "qwerty", "abc123", "111111", "andamo", "admin", "iloveyou"];

/** Estimativa simples e local (sem enviar a senha a lugar nenhum). */
export function passwordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  if (!password) return { score: 0, label: "Muito fraca", suggestions: ["Digite uma senha"] };

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  points += Math.max(0, classes - 1);

  const lower = password.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    points = Math.min(points, 1);
    suggestions.push("Evite senhas comuns ou previsíveis");
  }
  if (/(.)\1{2,}/.test(password)) {
    points -= 1;
    suggestions.push("Evite repetir o mesmo caractere");
  }
  if (password.length < 12) suggestions.push("Use 12 caracteres ou mais");
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) suggestions.push("Misture letras maiúsculas e minúsculas");
  if (!/[^A-Za-z0-9]/.test(password)) suggestions.push("Inclua um símbolo (ex.: ! # %)");

  const score = Math.max(0, Math.min(4, points - 1)) as PasswordStrength["score"];
  const label = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][score];
  return { score, label, suggestions: suggestions.slice(0, 2) };
}
