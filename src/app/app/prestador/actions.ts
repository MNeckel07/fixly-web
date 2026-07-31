"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { refundCharge } from "@/lib/gateway";

/**
 * O prestador desiste de um serviço.
 *
 * Três desfechos, escolhidos pelo estado real do pedido — nunca pela tela:
 *
 *  1. **Só proposta enviada** (ainda não foi escolhido) → retira a proposta.
 *     O pedido continua vivo para os outros profissionais.
 *  2. **Escolhido, mas o cliente ainda não pagou** → devolve o pedido para a
 *     fila (`provider_id = null`, status `buscando`). É o desfecho mais gentil:
 *     o cliente não perde o pedido, outro profissional pode pegar.
 *  3. **Escolhido e já pago** → **estorna** o contratante e cancela o serviço.
 *     Devolver para a fila aqui seria pior: o dinheiro está retido em nome de um
 *     acordo que acabou de ser desfeito.
 *
 * O estorno acontece ANTES de mexer no banco: se o gateway recusar, nada é
 * marcado como cancelado e o dinheiro não some do mapa.
 */
export async function cancelJobAsProvider(
  requestId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string; outcome?: "proposta_retirada" | "devolvido_a_fila" | "cancelado_com_estorno" }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("service_requests")
    .select("id, provider_id, status, no_charge")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { ok: false, error: "Serviço não encontrado." };
  if (["concluido", "cancelado"].includes(req.status)) {
    return { ok: false, error: "Este serviço já foi finalizado." };
  }

  // ── 1) ainda não é dele: retira a proposta ────────────────
  if (req.provider_id !== user.id) {
    const { data: prop } = await admin
      .from("proposals")
      .select("id")
      .eq("request_id", requestId)
      .eq("provider_id", user.id)
      .maybeSingle();
    if (!prop) return { ok: false, error: "Você não tem proposta neste pedido." };

    await admin.from("proposals").delete().eq("id", prop.id);
    revalidatePath("/app/prestador");
    return { ok: true, outcome: "proposta_retirada" };
  }

  // ── 2/3) é dele: depende de ter dinheiro preso ────────────
  const { data: pay } = await admin
    .from("payments")
    .select("id, status, gateway_id")
    .eq("request_id", requestId)
    .maybeSingle();

  const pago = pay && pay.status === "retido";

  if (pago) {
    if (pay!.gateway_id) {
      try {
        await refundCharge(pay!.gateway_id as string);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: "Não foi possível estornar o pagamento do cliente: " + msg };
      }
    }
    await admin.from("payments").update({ status: "reembolsado" }).eq("id", pay!.id);
    await admin
      .from("service_requests")
      .update({ status: "cancelado", provider_done_at: null, cancel_reason: reason ?? null })
      .eq("id", requestId);
    revalidatePath("/app/prestador");
    return { ok: true, outcome: "cancelado_com_estorno" };
  }

  // sem pagamento: volta para a fila e some da lista dele
  await admin.from("proposals").delete().eq("request_id", requestId).eq("provider_id", user.id);
  await admin
    .from("service_requests")
    .update({
      provider_id: null,
      status: "buscando",
      final_price: null,
      provider_done_at: null,
      cancel_reason: reason ?? null,
    })
    .eq("id", requestId);

  revalidatePath("/app/prestador");
  return { ok: true, outcome: "devolvido_a_fila" };
}
