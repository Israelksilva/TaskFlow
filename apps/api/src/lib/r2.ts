import { createHash, createHmac } from "node:crypto";
import { env, integrations } from "../config/env";
import { AppError } from "../shared/errors";

/**
 * Cloudflare R2 (API compatível com S3) com bucket PRIVADO.
 * Todo acesso a arquivo é feito por URL pré-assinada (AWS Signature V4) de curta duração, gerada só depois
 * de a API conferir a permissão do usuário. Nenhuma chave chega ao navegador.
 */
export class StorageUnavailableError extends AppError {
  constructor() {
    super(503, "STORAGE_NOT_CONFIGURED", "Armazenamento de arquivos ainda não configurado (Cloudflare R2).");
  }
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

export interface PresignInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  path: string; // já com o bucket: /bucket/chave
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  expiresSeconds: number;
  query?: Record<string, string>;
  now?: Date;
}

/** Assinatura V4 por query string (válida para S3/R2). Exportada para teste com o vetor oficial da AWS. */
export function presignUrl(i: PresignInput): string {
  const now = i.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${i.region}/s3/aws4_request`;
  const params: Record<string, string> = {
    ...(i.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(i.expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
  const canonicalPath = i.path.split("/").map(enc).join("/");
  const canonicalRequest = [i.method, canonicalPath, canonicalQuery, `host:${i.host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${i.secretAccessKey}`, date), i.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return `https://${i.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function config() {
  if (!integrations.storage) throw new StorageUnavailableError();
  return {
    host: `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: env.R2_BUCKET!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  };
}

function sign(method: PresignInput["method"], key: string, expiresSeconds: number, query?: Record<string, string>) {
  const c = config();
  return presignUrl({ method, host: c.host, path: `/${c.bucket}/${key}`, accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, region: "auto", expiresSeconds, query });
}

/** Nome seguro para o cabeçalho Content-Disposition (RFC 6266 / 5987). */
function disposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${enc(fileName)}`;
}

export const r2 = {
  /** URL para o navegador enviar o arquivo direto ao R2 (15 min). */
  uploadUrl: (key: string) => sign("PUT", key, 15 * 60),
  /** URL de download (60 s), sempre como anexo — o navegador não executa o conteúdo. */
  downloadUrl: (key: string, fileName: string) => sign("GET", key, 60, { "response-content-disposition": disposition(fileName) }),

  /** Tamanho do objeto no bucket, ou null se não existir. */
  async size(key: string): Promise<number | null> {
    const res = await fetch(sign("HEAD", key, 60), { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new AppError(502, "STORAGE_ERROR", `R2 respondeu ${res.status} ao consultar o arquivo`);
    return Number(res.headers.get("content-length") ?? "0");
  },

  async remove(key: string): Promise<void> {
    const res = await fetch(sign("DELETE", key, 60), { method: "DELETE", signal: AbortSignal.timeout(15_000) });
    if (!res.ok && res.status !== 404) throw new AppError(502, "STORAGE_ERROR", `R2 respondeu ${res.status} ao excluir o arquivo`);
  },
};
