"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { refundCharge } from "@/lib/gateway";
import { contaDoCancelamento } from "@/lib/cancellation";
import { providerNet, settlementDate, type PayMethod } from "@/lib/pricing";

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
 *
 * ── NO-SHOW DO CLIENTE (item 5.1 da política) ──────────────────────────────
 * `motivo: "no_show_cliente"` é o único caso em que o profissional cancela e
 * ainda assim recebe: ele foi até lá e não havia ninguém. A política manda
 * pagar a ele **a taxa de deslocamento** e devolver o resto ao cliente.
 *
 * Duas travas, porque este é o caminho por onde se ganharia dinheiro sem
 * trabalhar: só vale depois que o serviço saiu para o local (`a_caminho`, com o
 * carimbo `departed_at` da 0036) e respeitando a tolerância de 30 minutos do
 * horário combinado. Fora disso é cancelamento comum — item 4, reembolso
 * integral e o registro no histórico dele.
 */
export async function cancelJobAsProvider(
  requestId: string,
  reason?: string,
  motivo: "desisti" | "no_show_cliente" = "desisti",
): Promise<{ ok: boolean; error?: string; outcome?: "proposta_retirada" | "devolvido_a_fila" | "cancelado_com_estorno" | "no_show_cliente" }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("service_requests")
    .select(
      "id, client_id, provider_id, status, no_charge, mode, urgent, final_price, estimated_price, travel_fee, created_at, accepted_at, departed_at, started_at",
    )
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
    .select("id, status, gateway_id, amount, method")
    .eq("request_id", requestId)
    .maybeSingle();

  const pago = pay && pay.status === "retido";

  // ── 5.1) cliente ausente: o deslocamento é devido ao profissional ──
  if (motivo === "no_show_cliente") {
    if (!req.departed_at && req.status !== "a_caminho") {
      return {
        ok: false,
        error:
          "O no-show só pode ser registrado depois que você marcar que saiu para o local — é o carimbo que sustenta a taxa de deslocamento.",
      };
    }
    const conta = contaDoCancelamento(req as never, "no_show_cliente");
    if (pago) {
      const cobrado = Number(pay!.amount ?? 0) || 0;
      const devolver = Math.min(conta.reembolso, cobrado);
      if (pay!.gateway_id && devolver > 0) {
        try {
          await refundCharge(pay!.gateway_id as string, devolver >= cobrado - 0.01 ? undefined : devolver);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, error: "Não foi possível devolver a parte do cliente: " + msg };
        }
      }
      await admin
        .from("payments")
        .update(
          conta.retido > 0
            ? {
                status: "liberado",
                // no-show do cliente: o retido É a taxa de deslocamento, e ela
                // não paga comissão (ver lib/pricing.paymentBreakdown)
                provider_net: providerNet(conta.retidoServico, conta.retidoFrete),
                released_at: new Date().toISOString(),
                available_at: settlementDate((pay!.method as PayMethod) ?? "pix").toISOString(),
                refunded_amount: devolver,
                retained_amount: conta.retido,
                cancel_stage: conta.stage,
              }
            : { status: "reembolsado", refunded_amount: devolver, cancel_stage: conta.stage },
        )
        .eq("id", pay!.id);
    }
    await admin
      .from("service_requests")
      .update({
        status: "cancelado",
        provider_done_at: null,
        cancel_reason: reason ?? "Cliente ausente no local e horário combinados (no-show).",
        cancel_stage: conta.stage,
        cancelled_by: user.id,
      })
      .eq("id", requestId);
    revalidatePath("/app/prestador");
    return { ok: true, outcome: "no_show_cliente" };
  }

  if (pago) {
    if (pay!.gateway_id) {
      try {
        await refundCharge(pay!.gateway_id as string);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: "Não foi possível estornar o pagamento do cliente: " + msg };
      }
    }
    // item 4: cancelamento pelo profissional depois do aceite = reembolso
    // INTEGRAL ao cliente. Nada de retenção aqui — quem desistiu foi ele.
    await admin
      .from("payments")
      .update({
        status: "reembolsado",
        refunded_amount: Number(pay!.amount ?? 0) || 0,
        cancel_stage: "cancelado_pelo_profissional",
      })
      .eq("id", pay!.id);
    await admin
      .from("service_requests")
      .update({
        status: "cancelado",
        provider_done_at: null,
        cancel_reason: reason ?? null,
        cancel_stage: "cancelado_pelo_profissional",
        cancelled_by: user.id,
      })
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

/**
 * CONTESTAR UMA AVALIAÇÃO ABAIXO DE 3 ESTRELAS
 * ============================================
 * Pedido do dono: *"colocar a opção de contestar uma avaliação quando menor que
 * 3 estrelas"*.
 *
 * Por que isto é mais do que um desabafo: no Fixly a nota baixa cobra caro duas
 * vezes — derruba a média E derruba o Selo Fixly, que por sua vez muda quais
 * pedidos ele enxerga. Sem um canal, a única saída do profissional injustiçado
 * é pedir ao cliente que mude a nota — exatamente a "manipulação de avaliações"
 * que a denúncia proíbe. A contestação é a saída legítima.
 *
 * Quem decide é o suporte, e só ele: acolher ESCONDE a avaliação da média e do
 * perfil público (`review_hidden`), nunca reescreve a nota. O histórico
 * continua auditável, e o cliente não perde o que escreveu.
 *
 * As regras (quem pode, qual nota, uma vez só) moram no `dispute_review` da
 * 0036 — SECURITY DEFINER. Aqui a server action só traduz o erro do banco para
 * uma frase que o profissional entenda.
 */
export async function disputeReview(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const texto = reason.trim();
  if (texto.length < 20) {
    return {
      ok: false,
      error: "Conte o que aconteceu com pelo menos 20 caracteres — é o que permite ao suporte apurar.",
    };
  }

  const { error } = await supabase.rpc("dispute_review", {
    p_request_id: requestId,
    p_reason: texto,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/prestador/perfil");
  return { ok: true };
}
