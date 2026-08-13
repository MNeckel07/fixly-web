import "server-only";
import { paymentBreakdown, type PayMethod, type PaymentBreakdown } from "./pricing";
import type { SavedCard } from "./types";

export type { SavedCard };

/**
 * Camada de gateway de pagamento (server-only).
 *
 * Com MP_ACCESS_TOKEN configurado, fala com o Mercado Pago de verdade; sem ela,
 * opera em modo simulado (mock) para desenvolvimento local — as telas e o banco
 * funcionam igual, só não há dinheiro real.
 *
 * MODELO DE REPASSE
 *   1. o contratante paga o valor total;
 *   2. descontos, na ordem em que o MP aplica:
 *        tarifa do gateway  →  comissão Fixly (15%)  →  taxa de adiantamento;
 *   3. o líquido do prestador fica RETIDO até o contratante aprovar;
 *   4. aprovado, entra no saldo dele e fica sacável após o prazo do meio de
 *      pagamento (`available_at`);
 *   5. o saque vai para a chave PIX do cadastro (fila em `withdrawals`).
 *
 * Quando o prestador conecta a conta Mercado Pago dele (OAuth), o passo 3/4
 * é feito pelo próprio MP via `application_fee` (modo "split").
 */

export interface ChargeResult {
  id: string;
  gateway: "mercadopago" | "mock";
  status: "retido" | "pendente" | "recusado";
  method: PayMethod;
  breakdown: PaymentBreakdown;
  splitMode: "escrow" | "split";
  /** PIX: copia-e-cola e imagem do QR. */
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
  gatewayStatusDetail?: string;
}

export function isMercadoPagoConfigured() {
  return !!process.env.MP_ACCESS_TOKEN;
}

/**
 * Estamos em ambiente de TESTE (ou sem gateway)?
 *
 * Importa para o PIX: com credencial `TEST-` o Mercado Pago gera um BR Code
 * válido na forma, mas ligado a uma conta de teste — o app do banco lê e
 * responde "QR inválido". Não é defeito nosso, e sem avisar na tela isso vira
 * chamado de suporte toda vez. Só uma conta de teste do MP paga esse QR.
 */
export function isGatewaySandbox() {
  const token = process.env.MP_ACCESS_TOKEN;
  return !token || token.startsWith("TEST-");
}

export interface ChargeInput {
  amount: number;
  method: PayMethod;
  description: string;
  payerEmail?: string;
  payerDocument?: string;
  advancePct?: number;
  /** id do pedido — volta no webhook para conciliar. */
  externalReference?: string;
  /** Cartão/carteiras: token do Checkout Bricks. */
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  /** Cartão salvo: o dono do cartão no gateway (payer vira o customer). */
  customerId?: string;
  /** Presente = prestador conectou a conta dele; o MP faz o split. */
  providerAccessToken?: string;
}

/**
 * Cria a cobrança. PIX volta `pendente` (confirma no webhook); cartão
 * aprovado volta `retido` na hora.
 */
export async function createEscrowCharge(input: ChargeInput): Promise<ChargeResult> {
  const breakdown = paymentBreakdown(input.amount, input.method, input.advancePct ?? 0);

  if (isMercadoPagoConfigured()) {
    const mp = await import("./mercadopago");
    return mp.createMercadoPagoCharge(input, breakdown);
  }

  // Modo simulado (local): PIX finge um QR, cartão aprova na hora.
  await new Promise((r) => setTimeout(r, 900));
  const id = `mock_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    gateway: "mock",
    status: "retido",
    method: input.method,
    breakdown,
    splitMode: "escrow",
    ...(input.method === "pix"
      ? { pixQrCode: `00020126_MOCK_FIXLY_${id}_${breakdown.amount.toFixed(2)}` }
      : {}),
  };
}

/** Estado atual da cobrança no gateway (tela do PIX faz polling nisto). */
export async function fetchChargeStatus(
  chargeId: string,
): Promise<{ status: ChargeResult["status"]; detail?: string } | null> {
  if (!isMercadoPagoConfigured()) return { status: "retido" };
  const mp = await import("./mercadopago");
  try {
    const p = await mp.getMercadoPagoPayment(chargeId);
    return { status: p.mapped, detail: p.statusDetail };
  } catch {
    return null;
  }
}

/** Libera o valor retido ao prestador após a aprovação do contratante. */
export async function releaseEscrow(chargeId: string): Promise<void> {
  if (isMercadoPagoConfigured()) {
    const mp = await import("./mercadopago");
    await mp.releaseMercadoPago(chargeId);
    return;
  }
  await new Promise((r) => setTimeout(r, 200));
}

/** Libera só a parte adiantada (o contratante aprovou o adiantamento). */
export async function releaseAdvance(chargeId: string, amount: number): Promise<void> {
  if (isMercadoPagoConfigured()) {
    const mp = await import("./mercadopago");
    await mp.releaseMercadoPagoAdvance(chargeId, amount);
    return;
  }
  await new Promise((r) => setTimeout(r, 200));
}

/* ───────────────────── cartões salvos ───────────────────── */

/**
 * Sem gateway configurado (desenvolvimento), a carteira de cartões fica vazia e
 * salvar não faz nada — a tela continua funcionando, só não há o que listar.
 * É melhor do que inventar um cartão falso que não paga.
 */
export async function gatewayListCards(customerId: string): Promise<SavedCard[]> {
  if (!isMercadoPagoConfigured()) return [];
  const mp = await import("./mercadopago");
  return mp.listCustomerCards(customerId);
}

export async function gatewaySaveCard(customerId: string, token: string): Promise<SavedCard | null> {
  if (!isMercadoPagoConfigured()) return null;
  const mp = await import("./mercadopago");
  return mp.saveCustomerCard(customerId, token);
}

export async function gatewayDeleteCard(customerId: string, cardId: string): Promise<void> {
  if (!isMercadoPagoConfigured()) return;
  const mp = await import("./mercadopago");
  await mp.deleteCustomerCard(customerId, cardId);
}

/** Acha ou cria o "customer" do gateway para este e-mail. */
export async function gatewayEnsureCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  document?: string;
}): Promise<string | null> {
  if (!isMercadoPagoConfigured()) return null;
  const mp = await import("./mercadopago");
  const found = await mp.findCustomerByEmail(input.email);
  if (found) return found;
  return mp.createCustomer(input);
}

/** Reembolsa (cancelamento do serviço). */
export async function refundCharge(chargeId: string, amount?: number): Promise<void> {
  if (isMercadoPagoConfigured()) {
    const mp = await import("./mercadopago");
    await mp.refundMercadoPago(chargeId, amount);
    return;
  }
  await new Promise((r) => setTimeout(r, 200));
}
