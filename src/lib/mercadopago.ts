import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { PaymentBreakdown, PayMethod } from "./pricing";
import type { ChargeResult } from "./gateway";

/**
 * INTEGRAÇÃO MERCADO PAGO
 * =======================
 *
 * Dois modos de repasse, escolhidos por pagamento:
 *
 *  ESCROW (padrão) — o dinheiro entra na conta do FIXLY. Descontamos a tarifa do
 *  MP e a comissão do Fixly, e o líquido fica retido até o contratante aprovar.
 *  O prestador saca (PIX para a chave do cadastro). É o modo que funciona para
 *  quem não tem conta Mercado Pago — a maioria dos profissionais.
 *
 *  SPLIT — quando o prestador conectou a conta MP dele (OAuth), o pagamento é
 *  criado com o token DELE e `application_fee` = comissão do Fixly. O MP divide
 *  na hora: a comissão cai para nós, o resto na conta dele.
 *
 * Ordem dos descontos no MP: primeiro a tarifa do MP, depois a nossa comissão
 * sobre o restante. O `paymentBreakdown` mostra isso destacado ao contratante.
 *
 * Variáveis de ambiente:
 *   MP_ACCESS_TOKEN              access token da aplicação Fixly (APP_USR-… / TEST-…)
 *   NEXT_PUBLIC_MP_PUBLIC_KEY    public key (Checkout Bricks, no navegador)
 *   MP_WEBHOOK_SECRET            "assinatura secreta" do webhook (valida a origem)
 *   MP_CLIENT_ID / MP_CLIENT_SECRET   só para o OAuth do split
 */

const MP_API = "https://api.mercadopago.com";

export function isConfigured() {
  return !!process.env.MP_ACCESS_TOKEN;
}

async function mpFetch(
  path: string,
  init: RequestInit & { token?: string; idempotencyKey?: string } = {},
) {
  const token = init.token ?? process.env.MP_ACCESS_TOKEN!;
  const { idempotencyKey, ...rest } = init;
  delete (rest as { token?: string }).token;
  const res = await fetch(`${MP_API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(rest.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.message ?? body?.error ?? text ?? "erro desconhecido";
    throw new Error(`Mercado Pago (${res.status}): ${msg}`);
  }
  return body;
}

/** Mapeia o status do MP para o nosso. */
function mapStatus(mpStatus: string): ChargeResult["status"] {
  if (mpStatus === "approved" || mpStatus === "authorized") return "retido";
  if (mpStatus === "rejected" || mpStatus === "cancelled") return "recusado";
  return "pendente";
}

export interface MpChargeInput {
  amount: number;
  method: PayMethod;
  description: string;
  payerEmail?: string;
  /** Token do cartão gerado pelo Checkout Bricks (cartão/carteiras). */
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  payerDocument?: string;
  /** Referência do nosso lado (id do pedido) — volta no webhook. */
  externalReference?: string;
  /** Token do prestador (OAuth) — quando presente, o MP faz o split. */
  providerAccessToken?: string;
}

export async function createMercadoPagoCharge(
  input: MpChargeInput,
  breakdown: PaymentBreakdown,
): Promise<ChargeResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const split = !!input.providerAccessToken;

  /**
   * O MP valida o `notification_url` e RECUSA a cobrança inteira com
   * `400 notification_url attribute must be url valid` se ele não for uma URL
   * pública em https — `http://localhost:3000` cai nessa. Rodando local, a
   * saída é não mandar o campo: a tela do Pix consulta o pagamento a cada 5 s e
   * confirma do mesmo jeito. Em produção o campo vai normalmente.
   */
  const webhookUrl = /^https:\/\//i.test(appUrl) && !/localhost|127\.0\.0\.1|\.local(:|$)/i.test(appUrl)
    ? `${appUrl}/api/pagamentos/webhook`
    : null;

  const base: Record<string, unknown> = {
    transaction_amount: Number(breakdown.amount.toFixed(2)),
    description: input.description.slice(0, 250),
    external_reference: input.externalReference,
    ...(webhookUrl ? { notification_url: webhookUrl } : {}),
    statement_descriptor: "FIXLY",
    payer: {
      email: input.payerEmail ?? "cliente@fixly.company",
      ...(input.payerDocument
        ? { identification: { type: "CPF", number: input.payerDocument.replace(/\D/g, "") } }
        : {}),
    },
    // comissão do Fixly no split. Em escrow não vai (o valor já cai para nós).
    ...(split ? { application_fee: Number(breakdown.platformFee.toFixed(2)) } : {}),
  };

  const body =
    input.method === "pix"
      ? { ...base, payment_method_id: "pix" }
      : {
          ...base,
          token: input.cardToken,
          installments: input.installments ?? 1,
          payment_method_id: input.paymentMethodId,
          ...(input.issuerId ? { issuer_id: input.issuerId } : {}),
        };

  if (input.method !== "pix" && !input.cardToken) {
    throw new Error(
      "Pagamento com cartão exige o token do Checkout Bricks. Configure NEXT_PUBLIC_MP_PUBLIC_KEY e finalize o cartão na tela.",
    );
  }

  const payment = await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: `${input.externalReference ?? "fixly"}-${randomUUID()}`,
    token: input.providerAccessToken,
  });

  const tx = payment?.point_of_interaction?.transaction_data;
  return {
    id: String(payment.id),
    gateway: "mercadopago",
    status: mapStatus(String(payment.status)),
    method: input.method,
    breakdown,
    splitMode: split ? "split" : "escrow",
    pixQrCode: tx?.qr_code,
    pixQrCodeBase64: tx?.qr_code_base64,
    pixExpiresAt: tx?.expiration_date,
    gatewayStatusDetail: payment?.status_detail ? String(payment.status_detail) : undefined,
  };
}

/** Consulta o pagamento (usado pelo webhook e pela tela do PIX). */
export async function getMercadoPagoPayment(id: string) {
  const p = await mpFetch(`/v1/payments/${id}`, { method: "GET" });
  return {
    id: String(p.id),
    status: String(p.status),
    statusDetail: String(p.status_detail ?? ""),
    amount: Number(p.transaction_amount ?? 0),
    externalReference: p.external_reference ? String(p.external_reference) : null,
    mapped: mapStatus(String(p.status)),
  };
}

/**
 * Liberação do escrow. No modo SPLIT o MP já dividiu na captura — não há o que
 * liberar aqui. No modo ESCROW o valor está na conta do Fixly e sai para o
 * prestador no saque (fila em `withdrawals`, ver `request_withdrawal`).
 */
export async function releaseMercadoPago(chargeId: string): Promise<void> {
  void chargeId;
}

/** Adiantamento: mesma lógica do escrow — entra no saldo sacável do prestador. */
export async function releaseMercadoPagoAdvance(chargeId: string, amount: number): Promise<void> {
  void chargeId;
  void amount;
}

/** Reembolso (cancelamento). Sem valor = reembolso total. */
export async function refundMercadoPago(chargeId: string, amount?: number): Promise<void> {
  await mpFetch(`/v1/payments/${chargeId}/refunds`, {
    method: "POST",
    body: JSON.stringify(amount ? { amount: Number(amount.toFixed(2)) } : {}),
    idempotencyKey: `refund-${chargeId}-${randomUUID()}`,
  });
}

/* ─────────────────────────── webhook ─────────────────────────── */

/**
 * Confere a assinatura do webhook (header `x-signature`).
 * Formato: `ts=<epoch>,v1=<hmac>` e o manifest é
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * assinado em HMAC-SHA256 com a assinatura secreta da aplicação.
 */
export function verifyWebhookSignature(opts: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): { ok: boolean; reason?: string } {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "MP_WEBHOOK_SECRET não configurada" };
  if (!opts.signature || !opts.dataId) return { ok: false, reason: "assinatura ausente" };

  const parts = Object.fromEntries(
    opts.signature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  ) as { ts?: string; v1?: string };
  if (!parts.ts || !parts.v1) return { ok: false, reason: "assinatura malformada" };

  const manifest = `id:${opts.dataId.toLowerCase()};${
    opts.requestId ? `request-id:${opts.requestId};` : ""
  }ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "assinatura inválida" };

  // janela de 10 min contra replay
  const age = Math.abs(Date.now() / 1000 - Number(parts.ts));
  if (!Number.isFinite(age) || age > 600) return { ok: false, reason: "assinatura expirada" };
  return { ok: true };
}

/* ─────────────────────── OAuth (split) ─────────────────────── */

export function oauthAuthorizeUrl(state: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const params = new URLSearchParams({
    client_id: process.env.MP_CLIENT_ID ?? "",
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: `${appUrl}/api/pagamentos/oauth/callback`,
  });
  return `https://auth.mercadopago.com.br/authorization?${params}`;
}

export async function oauthExchangeCode(code: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const data = await mpFetch("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      redirect_uri: `${appUrl}/api/pagamentos/oauth/callback`,
    }),
  });
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
    userId: data.user_id ? String(data.user_id) : null,
    // o token do vendedor vale ~6 meses; renovar antes de vencer
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 15_552_000) * 1000),
  };
}

export async function oauthRefresh(refreshToken: string) {
  const data = await mpFetch("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 15_552_000) * 1000),
  };
}
