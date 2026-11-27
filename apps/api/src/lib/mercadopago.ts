import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env, integrations } from "../config/env";
import { AppError } from "../shared/errors";
import { logger } from "./logger";

/**
 * Cliente mínimo da API do Mercado Pago (assinaturas / preapproval).
 * Nesta versão só credenciais de TESTE são aceitas: `TEST-...` ou o access token de um usuário de teste
 * (a API do MP marca a conta com a tag `test_user`). Qualquer outra credencial é recusada.
 */
const BASE = "https://api.mercadopago.com";

export class PaymentsUnavailableError extends AppError {
  constructor(code: string, message: string) {
    super(503, code, message);
  }
}

export interface MpPreapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  sandbox_init_point?: string;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount: number; currency_id: string; frequency: number; frequency_type: string };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!integrations.payments) throw new PaymentsUnavailableError("PAYMENTS_NOT_CONFIGURED", "Pagamentos ainda não configurados (MP_ACCESS_TOKEN).");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...(method === "POST" ? { "x-idempotency-key": randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    // Não registra o corpo inteiro (pode conter e-mail do pagador); só status e mensagem.
    let message = text.slice(0, 200);
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message;
    } catch {
      /* corpo não-JSON */
    }
    logger.warn({ status: res.status, path }, "Mercado Pago respondeu com erro");
    throw new AppError(502, "PAYMENTS_PROVIDER_ERROR", `Mercado Pago: ${message}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}


let testCheck: { token: string; ok: boolean; at: number } | null = null;

/** Garante que a credencial é de teste. Resultado em cache por 10 minutos. */
export async function assertTestCredentials(): Promise<void> {
  const token = env.MP_ACCESS_TOKEN;
  if (!token) throw new PaymentsUnavailableError("PAYMENTS_NOT_CONFIGURED", "Pagamentos ainda não configurados (MP_ACCESS_TOKEN).");
  if (testCheck && testCheck.token === token && Date.now() - testCheck.at < 10 * 60_000) {
    if (!testCheck.ok) throw notTest();
    return;
  }
  let ok = token.startsWith("TEST-");
  if (!ok) {
    const me = await call<{ tags?: string[] }>("GET", "/users/me");
    ok = Array.isArray(me.tags) && me.tags.includes("test_user");
  }
  testCheck = { token, ok, at: Date.now() };
  if (!ok) throw notTest();
}

function notTest() {
  logger.error("MP_ACCESS_TOKEN não é de teste — pagamentos bloqueados nesta versão");
  return new PaymentsUnavailableError(
    "PAYMENTS_TEST_ONLY",
    "Esta versão aceita apenas credenciais de TESTE do Mercado Pago. Nenhuma cobrança foi feita.",
  );
}

/** Só para testes automatizados: esquece o resultado em cache. */
export function resetTestCheck() {
  testCheck = null;
}

export const mercadoPago = {
  async createPreapproval(input: { reason: string; amountCents: number; payerEmail: string; externalReference: string; backUrl: string }) {
    await assertTestCredentials();
    return call<MpPreapproval>("POST", "/preapproval", {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: input.amountCents / 100, currency_id: "BRL" },
    });
  },
  async getPreapproval(id: string) {
    await assertTestCredentials();
    return call<MpPreapproval>("GET", `/preapproval/${encodeURIComponent(id)}`);
  },
  async cancelPreapproval(id: string) {
    await assertTestCredentials();
    return call<MpPreapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "cancelled" });
  },
};

/**
 * Valida o cabeçalho `x-signature` dos webhooks (ts=...,v1=...).
 * Manifesto oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` assinado com HMAC-SHA256 (MP_WEBHOOK_SECRET).
 */
export function verifyWebhookSignature(input: { signature?: string; requestId?: string; dataId?: string }, now = Date.now()): boolean {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret || !input.signature || !input.requestId || !input.dataId) return false;
  const parts = Object.fromEntries(
    input.signature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  // Rejeita notificações muito antigas (replay). ts vem em milissegundos (ou segundos, em versões antigas).
  const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > 15 * 60_000) return false;
  const dataId = /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${dataId};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
