import "server-only";
import type { PaymentBreakdown, PayMethod } from "./pricing";
import type { ChargeResult } from "./gateway";

/**
 * Integração com o Mercado Pago (esqueleto pronto para credenciais).
 *
 * Para ativar:
 *  1. Crie uma aplicação em https://www.mercadopago.com.br/developers
 *  2. Preencha em .env.local:
 *       MP_ACCESS_TOKEN=APP_USR-... (ou TEST-... para sandbox)
 *       NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-... (usada no Checkout Bricks do cliente)
 *  3. (PIX) configure uma URL pública de webhook para confirmar o pagamento.
 *
 * O split é feito com `marketplace_fee` = comissão do Fixly. O valor restante
 * (menos a tarifa do MP) é creditado ao prestador conectado.
 */

const MP_API = "https://api.mercadopago.com";

async function mpFetch(path: string, init: RequestInit) {
  const token = process.env.MP_ACCESS_TOKEN!;
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mercado Pago (${res.status}): ${body}`);
  }
  return res.json();
}

export async function createMercadoPagoCharge(
  input: { amount: number; method: PayMethod; description: string; payerEmail?: string },
  breakdown: PaymentBreakdown,
): Promise<ChargeResult> {
  if (input.method === "pix") {
    // Cria pagamento PIX e retorna o QR Code (copia-e-cola).
    const payment = await mpFetch("/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: input.amount,
        description: input.description,
        payment_method_id: "pix",
        payer: { email: input.payerEmail ?? "cliente@fixly.com.br" },
        application_fee: breakdown.platformFee,
      }),
    });
    return {
      id: String(payment.id),
      gateway: "mercadopago",
      status: "pendente",
      method: input.method,
      breakdown,
      pixQrCode: payment?.point_of_interaction?.transaction_data?.qr_code,
    };
  }

  // Cartão / carteiras: o token do cartão vem do Checkout Bricks (cliente).
  // Aqui criaríamos o pagamento com o token recebido.
  throw new Error(
    "Pagamento com cartão/carteiras requer o token do Checkout Bricks (cliente). Configure o Brick para enviar o token.",
  );
}

export async function releaseMercadoPago(chargeId: string): Promise<void> {
  // Em marketplace, o repasse ao prestador ocorre conforme a liberação.
  // Aqui entraria a captura/transferência do valor retido.
  void chargeId;
}
