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

/**
 * Tarifas do gateway (Mercado Pago, tabela de 30/07/2026 — ver `docs/08`).
 * Cartão "na hora" é 4,98%; em 30 dias cairia para 3,99%, mas aí o prestador
 * esperaria um mês para receber. Conferir contra o contrato real na tela
 * "Taxas e parcelas" do painel do MP.
 */
export const GATEWAY_FEE_RATES: Record<PayMethod, number> = {
  pix: 0.0099, // 0,99%
  cartao: 0.0498, // 4,98% (crédito à vista, recebimento na hora)
  apple_pay: 0.0498,
  google_pay: 0.0498,
};

/**
 * Meios em que a tarifa é REPASSADA a quem escolheu o meio (Lei 13.455/2017
 * permite preço diferente por forma de pagamento).
 *
 * O Pix fica de fora de propósito: 0,99% sai da nossa comissão e o preço
 * anunciado continua limpo. Já o cartão custa 5× isso — sem repasse, ou o
 * prestador perde ~5% por uma escolha que não foi dele (era o comportamento
 * antigo), ou a comissão de 15% vira ~10%.
 */
export const PASSTHROUGH_METHODS: PayMethod[] = ["cartao", "apple_pay", "google_pay"];

export function isPassthrough(method: PayMethod): boolean {
  return PASSTHROUGH_METHODS.includes(method);
}

export function gatewayFee(amount: number, method: PayMethod): number {
  return Math.round(amount * GATEWAY_FEE_RATES[method] * 100) / 100;
}

/**
 * Quanto cobrar do contratante para que sobrem `serviceAmount` limpos depois da
 * tarifa. É `valor / (1 - taxa)`, **não** `valor × (1 + taxa)`: a tarifa incide
 * sobre o total cobrado, não sobre o preço do serviço. Em R$ 150 no cartão a
 * diferença entre as duas fórmulas é R$ 0,39 — que sairia do nosso bolso.
 */
export function chargedTotal(serviceAmount: number, method: PayMethod): number {
  if (!isPassthrough(method)) return serviceAmount;
  const rate = GATEWAY_FEE_RATES[method];
  return Math.round((serviceAmount / (1 - rate)) * 100) / 100;
}

/**
 * Prazo de CRÉDITO: quantos dias depois da aprovação o valor fica disponível
 * para o prestador sacar. Com "receber na hora" o MP credita os dois meios na
 * mesma hora — este 1 dia é a NOSSA janela de processamento do saque, que hoje
 * é manual (Admin → Saques), não o prazo do gateway.
 *
 * ⚠️ Se o MP colocar a conta no prazo de 7 dias (acontece com vendedor novo até
 * criar histórico), estes números passam a mentir para o prestador.
 */
export const SETTLEMENT_DAYS: Record<PayMethod, number> = {
  pix: 1,
  cartao: 1,
  apple_pay: 1,
  google_pay: 1,
};

/** Data em que o valor fica disponível para saque. */
export function settlementDate(method: PayMethod, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + (SETTLEMENT_DAYS[method] ?? 1));
  return d;
}

/** "amanhã", "quinta (30/07)" — texto curto de previsão de crédito. */
export function settlementLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return `amanhã (${dia})`;
  return `${d.toLocaleDateString("pt-BR", { weekday: "long" })} (${dia})`;
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
  /** Total cobrado do contratante = serviço + acréscimo. É o valor que vai ao gateway. */
  amount: number;
  /** Preço do serviço combinado com o prestador. Base da comissão e do líquido. */
  serviceAmount: number;
  /** Acréscimo do meio de pagamento cobrado do contratante (0 no Pix). */
  surcharge: number;
  platformFee: number; // comissão Fixly (15% do serviço)
  gatewayFee: number; // tarifa do meio de pagamento
  /** O que sobra para a Fixly: comissão menos a tarifa que ela banca (Pix). */
  platformNet: number;
  providerNet: number; // líquido total ao prestador
  advancePct: number; // % que o prestador recebe antes do serviço
  advanceAmount: number; // valor bruto adiantado
  advanceFee: number; // taxa extra pelo adiantamento
  providerUpfront: number; // líquido liberado ao prestador na contratação
  providerOnApproval: number; // líquido liberado ao aprovar a conclusão
}

/**
 * Composição do pagamento a partir do PREÇO DO SERVIÇO.
 *
 * Regra desde 30/07/2026 (ver `docs/08` e `docs/09`):
 *  - o prestador recebe **o mesmo** nos dois meios — a tarifa não encosta mais
 *    no líquido dele;
 *  - no cartão, a tarifa vira acréscimo para quem escolheu o cartão;
 *  - no Pix, a tarifa sai da comissão da Fixly (0,99% de 15% não dói).
 *
 * `advancePct` (0–100) é quanto o prestador optou por receber antes de concluir:
 * a comissão é rateada proporcionalmente e a taxa de adiantamento pesa só na
 * parte antecipada.
 */
export function paymentBreakdown(
  serviceAmount: number,
  method: PayMethod,
  advancePct = 0,
): PaymentBreakdown {
  const pct = Math.min(Math.max(advancePct, 0), 100);
  const charged = chargedTotal(serviceAmount, method);
  // no repasse, a tarifa é EXATAMENTE o acréscimo — definir assim (em vez de
  // recalcular taxa × total) impede um centavo de sobra por arredondamento.
  const gf = isPassthrough(method)
    ? round2(charged - serviceAmount)
    : gatewayFee(serviceAmount, method);
  const surcharge = isPassthrough(method) ? round2(charged - serviceAmount) : 0;

  const pf = platformFee(serviceAmount);
  const advanceAmount = round2((serviceAmount * pct) / 100);
  const advanceFee = round2(advanceAmount * ADVANCE_FEE_RATE);

  const providerNet = round2(serviceAmount - pf - advanceFee);
  const platformNet = round2(pf + advanceFee - (isPassthrough(method) ? 0 : gf));

  const providerUpfront = round2(advanceAmount - (pf * pct) / 100 - advanceFee);
  const providerOnApproval = round2(providerNet - providerUpfront);

  return {
    amount: charged,
    serviceAmount,
    surcharge,
    platformFee: pf,
    gatewayFee: gf,
    platformNet,
    providerNet,
    advancePct: pct,
    advanceAmount,
    advanceFee,
    providerUpfront,
    providerOnApproval,
  };
}

/**
 * Líquido do prestador a partir do preço do serviço. Desde o repasse da tarifa
 * ao contratante isto é EXATO (antes era aproximado, porque a tarifa do gateway
 * ainda saía daqui).
 */
export function providerNet(amount: number): number {
  return Math.round((amount - platformFee(amount)) * 100) / 100;
}

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
