"use server";

import { createClient } from "@/lib/supabase/server";
import { createEscrowCharge, releaseEscrow } from "@/lib/gateway";
import type { PayMethod, PaymentBreakdown } from "@/lib/pricing";

export interface PayResult {
  ok: boolean;
  error?: string;
  status?: "retido" | "pendente";
  breakdown?: PaymentBreakdown;
  pixQrCode?: string;
}

export async function processPayment(
  requestId: string,
  amount: number,
  method: PayMethod,
): Promise<PayResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, description")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  let charge;
  try {
    charge = await createEscrowCharge({
      amount,
      method,
      description: req.description ?? "Serviço Fixly",
      payerEmail: user.email ?? undefined,
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const { breakdown } = charge;
  await supabase.from("payments").insert({
    request_id: requestId,
    amount: breakdown.amount,
    fee: breakdown.platformFee,
    gateway_fee: breakdown.gatewayFee,
    provider_net: breakdown.providerNet,
    method,
    gateway: charge.gateway,
    gateway_id: charge.id,
    gateway_status: charge.status,
    status: charge.status === "retido" ? "retido" : "retido",
  });

  if (charge.status === "retido") {
    await supabase.from("service_requests").update({ status: "a_caminho" }).eq("id", requestId);
  }

  return { ok: true, status: charge.status, breakdown, pixQrCode: charge.pixQrCode };
}

/** Contratante aprova a conclusão: libera o escrow ao prestador. */
export async function approveService(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  const { data: pay } = await supabase
    .from("payments")
    .select("gateway_id")
    .eq("request_id", requestId)
    .maybeSingle();

  try {
    if (pay?.gateway_id) await releaseEscrow(pay.gateway_id);
  } catch { /* ignora falha de liberacao no mock */ }

  await supabase
    .from("payments")
    .update({ status: "liberado", released_at: new Date().toISOString() })
    .eq("request_id", requestId);
  await supabase.from("service_requests").update({ status: "concluido" }).eq("id", requestId);

  return { ok: true };
}
