import { createHmac, randomBytes } from "node:crypto";

/** TOTP (RFC 6238): 6 dígitos, passo de 30 s, HMAC-SHA1 — compatível com Google Authenticator, Authy etc. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function generateSecret(bytes = 20): string {
  let bits = "";
  for (const byte of randomBytes(bytes)) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(secret: string): Buffer {
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Segredo base32 inválido");
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateCode(secret: string, time = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

/** Aceita o código atual e um passo antes/depois (tolerância de relógio). */
export function verifyCode(secret: string, code: string, time = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((drift) => generateCode(secret, time + drift * STEP * 1000) === code);
}

export function otpauthUrl(secret: string, account: string, issuer = "Andamo"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}
