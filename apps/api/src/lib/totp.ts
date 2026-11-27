import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** TOTP (RFC 6238): SHA-1, 6 dígitos, passo de 30 s — o padrão dos apps autenticadores. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Base32 inválido");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Segredo novo de 160 bits, em base32. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, "0");
}

export const totpCounter = (now = Date.now()) => Math.floor(now / 1000 / STEP);

export const totp = (secret: string, now = Date.now()) => hotp(secret, totpCounter(now));

/**
 * Valida o código aceitando ±1 passo (relógios fora de sincronia).
 * Retorna o contador aceito (para impedir reuso) ou `null`.
 */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpCounter(now);
  for (const counter of [current - 1, current, current + 1]) {
    const expected = Buffer.from(hotp(secret, counter));
    if (timingSafeEqual(expected, Buffer.from(code))) return counter;
  }
  return null;
}

export const otpauthUrl = (secret: string, account: string, issuer = "Andamo") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
