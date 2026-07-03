import "server-only";
import { paymentBreakdown, type PayMethod, type PaymentBreakdown } from "./pricing";

/**
 * Camada de gateway de pagamento (server-only).
 *
 * Suporta Mercado Pago quando MP_ACCESS_TOKEN está configurado; caso
 * contrário, opera em modo simulado (mock) para desenvolvimento local.
 *
 * Modelo de repasse (escrow + split):
 *  - o contratante paga o valor total;
 *  - o Fixly retém comissão (15%) + tarifa do gateway;
 *  - o líquido é repassado ao prestador após a conclusão do serviço.
 */

export interface ChargeResult {
  id: string;
  gateway: "mercadopago" | "mock";
  status: "retido" | "pendente";
  method: PayMethod;
  breakdown: PaymentBreakdown;
  pixQrCode?: string; // base64/copia-e-cola quando PIX
}

export function isMercadoPagoConfigured() {
  return !!process.env.MP_ACCESS_TOKEN;
}

/**
 * Cria uma cobrança e RETÉM o valor (escrow). Em produção com Mercado Pago,
 * aqui entra a criação da preferência/pagamento via API do MP.
 */
export async function createEscrowCharge(input: {
  amount: number;
  method: PayMethod;
  description: string;
  payerEmail?: string;
}): Promise<ChargeResult> {
  const breakdown = paymentBreakdown(input.amount, input.method);

  if (isMercadoPagoConfigured()) {
    // TODO(produção): criar pagamento no Mercado Pago.
    //   - Cartão/Wallets: Checkout Bricks (token do cartão vindo do cliente).
    //   - PIX: cria pagamento e retorna QR Code; confirmação via webhook.
    //   O marketplace_fee do MP recebe a comissão da plataforma.
    const mp = await import("./mercadopago");
    return mp.createMercadoPagoCharge(input, breakdown);
  }

  // Modo simulado (local)
  await new Promise((r) => setTimeout(r, 1200));
  return {
    id: `mock_${Math.random().toString(36).slice(2, 10)}`,
    gateway: "mock",
    status: "retido",
    method: input.method,
    breakdown,
  };
}

/** Libera o valor retido ao prestador após a aprovação do contratante. */
export async function releaseEscrow(chargeId: string): Promise<void> {
  if (isMercadoPagoConfigured()) {
    const mp = await import("./mercadopago");
    await mp.releaseMercadoPago(chargeId);
    return;
  }
  await new Promise((r) => setTimeout(r, 400));
}
