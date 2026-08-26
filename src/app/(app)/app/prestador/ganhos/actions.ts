"use server";

import { createClient } from "@/lib/supabase/server";

export interface Balance {
  liberado: number;
  a_liberar: number;
  em_servico: number;
  adiantado: number;
  sacado: number;
  disponivel: number;
}

/** Saldo da carteira, calculado no banco (RPC `provider_balance`). */
export async function getBalance(): Promise<Balance> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("provider_balance");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    liberado: Number(row?.liberado ?? 0),
    a_liberar: Number(row?.a_liberar ?? 0),
    em_servico: Number(row?.em_servico ?? 0),
    adiantado: Number(row?.adiantado ?? 0),
    sacado: Number(row?.sacado ?? 0),
    disponivel: Number(row?.disponivel ?? 0),
  };
}

/**
 * Pede um saque. O VALOR é validado no banco (`request_withdrawal`), que
 * recalcula o saldo disponível — o cliente não decide quanto pode sacar.
 */
export async function requestWithdrawal(amount: number): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.rpc("request_withdrawal", { p_amount: amount });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  return { ok: true };
}
