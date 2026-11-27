import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../config/env";

/** Token aleatório seguro em base64url (padrão: 32 bytes = 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** SHA-256 em hexadecimal. Usado para guardar tokens de alta entropia (nunca senhas). */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const key: Buffer = env.DATA_ENCRYPTION_KEY
  ? Buffer.from(env.DATA_ENCRYPTION_KEY, "hex")
  : Buffer.from(hkdfSync("sha256", env.JWT_SECRET, "andamo", "data-encryption-v1", 32));

/** Cifra com AES-256-GCM. Formato: v1.<iv>.<tag>.<dados> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Formato de dado cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
