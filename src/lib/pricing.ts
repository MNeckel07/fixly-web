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

/**
 * Precificação rápida (estilo Uber): preço-base da categoria ajustado por
 * urgência e distância. Retorna o valor estimado ao contratante.
 */
export function estimatePrice(
  basePrice: number,
  urgent: boolean,
  distanceKm: number,
): number {
  const urgencyMult = urgent ? 1.4 : 1;
  const distanceFee = Math.round(distanceKm * 3.5);
  return Math.max(basePrice, Math.round(basePrice * urgencyMult + distanceFee));
}

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

export interface PaymentBreakdown {
  amount: number; // valor pago pelo contratante
  platformFee: number; // comissão Fixly (15%)
  gatewayFee: number; // tarifa do meio de pagamento
  providerNet: number; // líquido ao prestador
}

/** Composição do pagamento: quanto o prestador recebe após comissão e tarifas. */
export function paymentBreakdown(amount: number, method: PayMethod): PaymentBreakdown {
  const pf = platformFee(amount);
  const gf = gatewayFee(amount, method);
  return {
    amount,
    platformFee: pf,
    gatewayFee: gf,
    providerNet: Math.round((amount - pf - gf) * 100) / 100,
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
