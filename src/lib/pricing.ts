/** Distância aproximada em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Comissão da plataforma (%) aplicada sobre o valor do serviço. */
export const PLATFORM_FEE_RATE = 0.15;

export function platformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
}

export type PayMethod = "pix" | "cartao" | "apple_pay" | "google_pay";

/** Tarifas do gateway (Mercado Pago) por meio de pagamento. */
export const GATEWAY_FEE_RATES: Record<PayMethod, number> = {
  pix: 0.0099, // ~0,99%
  cartao: 0.0379, // ~3,79% (crédito à vista)
  apple_pay: 0.0379,
  google_pay: 0.0379,
};

export function gatewayFee(amount: number, method: PayMethod): number {
  return Math.round(amount * GATEWAY_FEE_RATES[method] * 100) / 100;
}

/**
 * Taxa extra de ADIANTAMENTO: incide só sobre a parte que o prestador quer
 * receber ANTES de concluir o serviço. Quanto mais ele adianta, mais paga —
 * por isso o líquido cai. Simulado; ajuste o número aqui quando definir a regra
 * real (junto com o Mercado Pago).
 */
export const ADVANCE_FEE_RATE = 0.08; // 8% sobre o valor adiantado

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaymentBreakdown {
  amount: number; // valor pago pelo contratante
  platformFee: number; // comissão Fixly (15%)
  gatewayFee: number; // tarifa do meio de pagamento
  providerNet: number; // líquido total ao prestador
  advancePct: number; // % que o prestador recebe antes do serviço
  advanceAmount: number; // valor bruto adiantado
  advanceFee: number; // taxa extra pelo adiantamento
  providerUpfront: number; // líquido liberado ao prestador na contratação
  providerOnApproval: number; // líquido liberado ao aprovar a conclusão
}

/**
 * Composição do pagamento: quanto o prestador recebe após comissão, tarifas e a
 * taxa de adiantamento. `advancePct` (0–100) é quanto ele optou por receber antes
 * de concluir — as taxas comuns são rateadas e a taxa de adiantamento pesa só na
 * parte antecipada.
 */
export function paymentBreakdown(amount: number, method: PayMethod, advancePct = 0): PaymentBreakdown {
  const pct = Math.min(Math.max(advancePct, 0), 100);
  const pf = platformFee(amount);
  const gf = gatewayFee(amount, method);
  const advanceAmount = round2((amount * pct) / 100);
  const advanceFee = round2(advanceAmount * ADVANCE_FEE_RATE);
  const providerNet = round2(amount - pf - gf - advanceFee);
  // parte adiantada: rateio proporcional das taxas comuns + toda a taxa de adiantamento
  const providerUpfront = round2(advanceAmount - ((pf + gf) * pct) / 100 - advanceFee);
  const providerOnApproval = round2(providerNet - providerUpfront);
  return {
    amount,
    platformFee: pf,
    gatewayFee: gf,
    providerNet,
    advancePct: pct,
    advanceAmount,
    advanceFee,
    providerUpfront,
    providerOnApproval,
  };
}

/** Líquido aproximado (sem tarifa de gateway) — usado em telas de resumo. */
export function providerNet(amount: number): number {
  return Math.round((amount - platformFee(amount)) * 100) / 100;
}

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
