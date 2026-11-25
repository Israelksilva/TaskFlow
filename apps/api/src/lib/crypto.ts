import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

/** Token aleatório seguro em base64url (links de e-mail, refresh tokens, convites). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Hash SHA-256 em hex: tokens são guardados só como hash no banco. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const key = createHash("sha256")
  .update(env.ENCRYPTION_KEY ?? `andamo-enc:${env.JWT_SECRET}`)
  .digest();

/** AES-256-GCM: `iv.tag.ciphertext` em base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
