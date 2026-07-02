/**
 * Camada de abstração do gateway de pagamento (escrow / pagamento protegido).
 *
 * Hoje: implementação MOCK para o protótipo.
 * Amanhã: trocar o corpo destas funções pela integração real (recomendado
 * Iugu ou Pagar.me — que suportam split/marketplace e retenção no Brasil).
 * A interface abaixo foi desenhada para não exigir mudança no restante do app.
 */

export type PaymentMethod = "pix" | "cartao";

export interface EscrowCharge {
  id: string;
  status: "retido" | "liberado" | "reembolsado";
  amount: number;
  method: PaymentMethod;
}

/** Cria uma cobrança e RETÉM o valor (escrow) até a aprovação do serviço. */
export async function createEscrowCharge(input: {
  amount: number;
  method: PaymentMethod;
}): Promise<EscrowCharge> {
  // Simula latência de processamento do gateway.
  await new Promise((r) => setTimeout(r, 1400));
  return {
    id: `mock_${Math.random().toString(36).slice(2, 10)}`,
    status: "retido",
    amount: input.amount,
    method: input.method,
  };
}

/** Libera o valor retido para o prestador após aprovação do contratante. */
export async function releaseEscrow(chargeId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  void chargeId;
}
