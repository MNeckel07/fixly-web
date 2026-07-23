"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createEscrowCharge, releaseEscrow } from "@/lib/gateway";
import type { PayMethod, PaymentBreakdown } from "@/lib/pricing";

export interface PayResult {
  ok: boolean;
  error?: string;
  status?: "retido" | "pendente";
  breakdown?: PaymentBreakdown;
  pixQrCode?: string;
}

/**
 * Processa o pagamento. O VALOR é derivado no servidor (a partir da proposta
 * aceita ou do preço do pedido) — NUNCA confiando em valor vindo do cliente.
 * A escrita na tabela de pagamentos usa a chave de servidor (RLS bloqueia o
 * cliente de escrever pagamentos diretamente).
 */
export async function processPayment(requestId: string, method: PayMethod): Promise<PayResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, description, estimated_price, final_price, advance_pct")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  // valor confiável: proposta aceita (gerada no servidor) > final > estimado
  const { data: prop } = await supabase
    .from("proposals")
    .select("price")
    .eq("request_id", requestId)
    .eq("status", "aceita")
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();
  const amount = Number(prop?.price ?? req.final_price ?? req.estimated_price ?? 0);
  if (!amount || amount <= 0) return { ok: false, error: "Valor do serviço indefinido" };

  const advancePct = Number(req.advance_pct ?? 0);
  let charge;
  try {
    charge = await createEscrowCharge({
      amount,
      method,
      description: req.description ?? "Serviço Fixly",
      payerEmail: user.email ?? undefined,
      advancePct,
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const { breakdown } = charge;
  const admin = createAdminClient();
  await admin.from("payments").insert({
    request_id: requestId,
    amount: breakdown.amount,
    fee: breakdown.platformFee,
    gateway_fee: breakdown.gatewayFee,
    provider_net: breakdown.providerNet,
    advance_pct: breakdown.advancePct,
    advance_amount: breakdown.advanceAmount,
    advance_fee: breakdown.advanceFee,
    method,
    gateway: charge.gateway,
    gateway_id: charge.id,
    gateway_status: charge.status,
    status: "retido",
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

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("gateway_id")
    .eq("request_id", requestId)
    .maybeSingle();

  try {
    if (pay?.gateway_id) await releaseEscrow(pay.gateway_id);
  } catch { /* ignora falha de liberacao no mock */ }

  await admin
    .from("payments")
    .update({ status: "liberado", released_at: new Date().toISOString() })
    .eq("request_id", requestId);
  await supabase.from("service_requests").update({ status: "concluido" }).eq("id", requestId);

  return { ok: true };
}

/** Cancela o pedido/serviço. Se já houver pagamento retido, reembolsa (mock). */
export async function cancelService(requestId: string): Promise<{ ok: boolean; error?: string; refunded?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };
  if (["concluido", "cancelado"].includes(req.status)) return { ok: false, error: "Este serviço não pode ser cancelado." };

  const admin = createAdminClient();
  let refunded = false;
  const { data: pay } = await admin.from("payments").select("id, status").eq("request_id", requestId).maybeSingle();
  if (pay && pay.status === "retido") {
    await admin.from("payments").update({ status: "reembolsado" }).eq("request_id", requestId);
    refunded = true;
  }
  await supabase.from("service_requests").update({ status: "cancelado" }).eq("id", requestId);
  return { ok: true, refunded };
}
