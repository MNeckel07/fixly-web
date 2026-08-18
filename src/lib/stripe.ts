import "server-only";
import type { PaymentBreakdown, PayMethod } from "./pricing";
import type { ChargeResult } from "./gateway";

/**
 * STRIPE — só para as CARTEIRAS (Apple Pay e Google Pay)
 * ======================================================
 *
 * Por que um segundo gateway: o Mercado Pago **não oferece** Apple Pay nem
 * Google Pay no Brasil, e também não está na lista de processadores aceitos
 * pela API do Google Pay. Não é configuração — é ausência de produto. Pix e
 * cartão digitado continuam no MP, que é mais barato no Pix.
 *
 * Detalhe que economiza dinheiro: pelo Stripe, o **Apple Pay não exige a conta
 * de desenvolvedor da Apple** (US$ 99/ano). O certificado é do Stripe; basta
 * validar o domínio no painel deles.
 *
 * O modelo de dinheiro não muda: o valor cai na conta do Fixly (escrow), o
 * líquido do profissional fica retido até o contratante aprovar, e o saque
 * continua saindo por Pix na fila do Admin.
 *
 * Variáveis:
 *   STRIPE_SECRET_KEY                  sk_live_… / sk_test_…
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_live_… / pk_test_…
 */

const API = "https://api.stripe.com/v1";

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Métodos que rodam no Stripe (o resto vai para o Mercado Pago). */
export function isWalletMethod(method: PayMethod): boolean {
  return method === "apple_pay" || method === "google_pay";
}

/**
 * O Stripe fala `application/x-www-form-urlencoded`, com colchetes para os
 * objetos aninhados (`metadata[request_id]`). Sem uma serialização assim, os
 * campos aninhados chegam como string e o Stripe ignora em silêncio.
 */
function form(data: Record<string, unknown>, prefixo = ""): string {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      partes.push(form(v as Record<string, unknown>, chave));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => partes.push(`${encodeURIComponent(`${chave}[${i}]`)}=${encodeURIComponent(String(item))}`));
    } else {
      partes.push(`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`);
    }
  }
  return partes.filter(Boolean).join("&");
}

async function stripeFetch(path: string, body?: Record<string, unknown>, idempotencyKey?: string) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body ? { body: form(body) } : {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Stripe (${res.status}): ${json?.error?.message ?? "erro desconhecido"}`);
  }
  return json;
}

/** Centavos — o Stripe cobra em inteiro, e 1,005 arredondado errado vira bug de R$ 0,01. */
const centavos = (v: number) => Math.round(v * 100);

/**
 * Cria a intenção de pagamento da carteira. Quem confirma é o navegador (com
 * a digital/Face ID do dono do aparelho); o servidor confere depois, em
 * `getStripePaymentIntent`, antes de dar o serviço como pago.
 */
export async function createStripeWalletIntent(input: {
  amount: number;
  method: PayMethod;
  description: string;
  requestId: string;
  payerEmail?: string;
  breakdown: PaymentBreakdown;
}): Promise<ChargeResult & { clientSecret: string }> {
  const pi = await stripeFetch(
    "/payment_intents",
    {
      amount: centavos(input.breakdown.amount),
      currency: "brl",
      description: input.description.slice(0, 250),
      receipt_email: input.payerEmail,
      // as carteiras entram como cartão tokenizado — é assim que o Stripe as trata
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        request_id: input.requestId,
        origem: "fixly",
        metodo: input.method,
      },
    },
    `fixly-${input.requestId}-${Date.now()}`,
  );

  return {
    id: String(pi.id),
    gateway: "stripe",
    status: "pendente",
    method: input.method,
    breakdown: input.breakdown,
    splitMode: "escrow",
    clientSecret: String(pi.client_secret),
  };
}

/** Estado real da cobrança — é isto que autoriza marcar o serviço como pago. */
export async function getStripePaymentIntent(id: string) {
  const pi = await stripeFetch(`/payment_intents/${id}`);
  const status = String(pi.status);
  return {
    id: String(pi.id),
    status,
    /** Valor REALMENTE cobrado, em reais. Nunca confiar no valor do cliente. */
    amount: Number(pi.amount_received ?? pi.amount ?? 0) / 100,
    requestId: pi.metadata?.request_id ? String(pi.metadata.request_id) : null,
    mapped: (status === "succeeded"
      ? "retido"
      : status === "canceled"
        ? "recusado"
        : "pendente") as ChargeResult["status"],
  };
}

export async function refundStripe(paymentIntentId: string, amount?: number): Promise<void> {
  await stripeFetch(
    "/refunds",
    {
      payment_intent: paymentIntentId,
      ...(amount ? { amount: centavos(amount) } : {}),
    },
    `refund-${paymentIntentId}-${Date.now()}`,
  );
}
