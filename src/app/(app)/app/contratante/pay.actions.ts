"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createEscrowCharge, releaseEscrow, releaseAdvance, refundCharge, fetchChargeStatus, isGatewaySandbox } from "@/lib/gateway";
import { currentCustomerId, saveCard } from "@/app/(app)/app/contratante/cards.actions";
import { notifySealChanges } from "@/app/(app)/app/notify.actions";
import { revalidatePath } from "next/cache";
import { paymentBreakdown, settlementDate, providerNet, type PayMethod, type PaymentBreakdown } from "@/lib/pricing";
import {
  contaDoCancelamento,
  prazoDoReembolso,
  type ContaCancelamento,
  type MotivoCancelamento,
} from "@/lib/cancellation";

export interface PayResult {
  ok: boolean;
  error?: string;
  status?: "retido" | "pendente" | "recusado";
  breakdown?: PaymentBreakdown;
  /** PIX: copia-e-cola + imagem do QR (o valor só é confirmado no webhook). */
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
  /** Carteira (Stripe): o navegador confirma com a digital usando este segredo. */
  clientSecret?: string;
  detail?: string;
}

/** Dados do cartão tokenizado pelo Checkout Bricks (nunca o número do cartão). */
export interface CardPayload {
  token: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  payerDocument?: string;
  /** Pagamento com cartão JÁ salvo (o token veio de cardId + CVV). */
  savedCardId?: string;
  /**
   * Segundo token, gerado só para guardar o cartão na carteira. Existe porque o
   * token do MP é de uso único: o da cobrança morre na cobrança.
   */
  saveCardToken?: string;
}

/**
 * Processa o pagamento. O VALOR é derivado no servidor (a partir da proposta
 * aceita ou do preço do pedido) — NUNCA confiando em valor vindo do cliente.
 * A escrita na tabela de pagamentos usa a chave de servidor (RLS bloqueia o
 * cliente de escrever pagamentos diretamente).
 *
 * Cartão: o navegador manda só o TOKEN do Checkout Bricks — o número do cartão
 * nunca passa pelo nosso servidor.
 */
export async function processPayment(
  requestId: string,
  method: PayMethod,
  card?: CardPayload,
): Promise<PayResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, provider_id, description, estimated_price, final_price, advance_pct")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  const admin = createAdminClient();

  // não cobra duas vezes o mesmo pedido
  const { data: existing } = await admin
    .from("payments")
    .select("id, status, gateway_status")
    .eq("request_id", requestId)
    .maybeSingle();
  if (existing && existing.status !== "reembolsado" && existing.gateway_status !== "recusado") {
    return { ok: false, error: "Este serviço já tem um pagamento em andamento." };
  }

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

  // Split: se o prestador conectou a conta dele no gateway, o MP divide na hora.
  let providerAccessToken: string | undefined;
  if (req.provider_id) {
    const { data: acct } = await admin
      .from("provider_gateway_accounts")
      .select("access_token, expires_at")
      .eq("provider_id", req.provider_id)
      .maybeSingle();
    if (acct?.access_token && (!acct.expires_at || new Date(acct.expires_at) > new Date())) {
      providerAccessToken = acct.access_token as string;
    }
  }

  const advancePct = Number(req.advance_pct ?? 0);

  // Cartão salvo: o pagador deixa de ser um e-mail e passa a ser o customer do
  // gateway — é ele quem "possui" o cartão tokenizado.
  const customerId = card?.savedCardId ? await currentCustomerId() : null;
  if (card?.savedCardId && !customerId) {
    return { ok: false, error: "Não foi possível usar o cartão salvo. Tente com um cartão novo." };
  }

  let charge;
  try {
    charge = await createEscrowCharge({
      amount,
      method,
      description: req.description ?? "Serviço Fixly",
      payerEmail: user.email ?? undefined,
      advancePct,
      externalReference: requestId,
      providerAccessToken,
      ...(card
        ? {
            cardToken: card.token,
            installments: card.installments,
            paymentMethodId: card.paymentMethodId,
            issuerId: card.issuerId,
            payerDocument: card.payerDocument,
            ...(customerId ? { customerId } : {}),
          }
        : {}),
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  /**
   * O cliente não vê nada sobre ambiente — o site é produto acabado. Mas o Pix
   * gerado com credencial `TEST-` é recusado pelo app do banco, e sem este
   * registro a equipe perde tempo procurando bug no código que está certo.
   */
  if (method === "pix" && isGatewaySandbox()) {
    console.warn(
      "[pagamento] Pix gerado com credencial de TESTE do Mercado Pago — o app do banco vai recusar este QR. Troque MP_ACCESS_TOKEN/NEXT_PUBLIC_MP_PUBLIC_KEY pelas de produção (APP_USR-).",
    );
  }

  if (charge.status === "recusado") {
    return { ok: false, error: "Pagamento recusado pela operadora.", detail: charge.gatewayStatusDetail };
  }

  /**
   * Guardar o cartão vem DEPOIS de a cobrança dar certo, e nunca derruba o
   * pagamento: se o MP recusar o segundo token, o serviço já está pago — o que
   * não pode é o cliente ver erro numa compra que funcionou.
   */
  // (aqui a cobrança recusada já retornou acima, então chegar neste ponto
  //  significa aprovada ou pendente)
  if (card?.saveCardToken) {
    await saveCard(card.saveCardToken);
  }

  const { breakdown } = charge;
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
    split_mode: charge.splitMode,
    // 'retido' só quando o dinheiro entrou; PIX pendente fica aguardando webhook
    status: charge.status === "retido" ? "retido" : "pendente",
  });

  if (charge.status === "retido") {
    await supabase.from("service_requests").update({ status: "a_caminho" }).eq("id", requestId);
  }

  return {
    ok: true,
    status: charge.status,
    breakdown,
    pixQrCode: charge.pixQrCode,
    pixQrCodeBase64: charge.pixQrCodeBase64,
    pixExpiresAt: charge.pixExpiresAt,
    clientSecret: charge.clientSecret,
  };
}

/**
 * SELO FIX — segue o serviço sem passar pelo gateway.
 *
 * Exige selo NOS DOIS LADOS: se o prestador que aceitou for conta real, a
 * cobrança entra em vigor e esta ação recusa. É a regra que impede alguém de
 * fechar serviço de verdade sem pagar só porque o contratante tem selo.
 *
 * Não grava em `payments` de propósito — sem linha de pagamento, o valor não
 * entra na carteira do prestador, não vira saque e não aparece no faturamento.
 * O `no_charge` no pedido é o que sustenta a tarja na tela.
 */
export async function skipPayment(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, provider_id, status, no_charge")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };
  if (["concluido", "cancelado"].includes(req.status)) {
    return { ok: false, error: "Este serviço já foi finalizado." };
  }

  const admin = createAdminClient();

  // já pago de verdade? não deixa "virar" cortesia depois
  const { data: pay } = await admin
    .from("payments")
    .select("id, status")
    .eq("request_id", requestId)
    .maybeSingle();
  if (pay && pay.status !== "reembolsado") {
    return { ok: false, error: "Este serviço já tem um pagamento em andamento." };
  }

  // o selo é lido no SERVIDOR — a tela nunca decide isso
  const ids = [req.client_id, req.provider_id].filter(Boolean) as string[];
  const { data: perfis } = (await admin
    .from("profiles")
    .select("id, fix_badge, full_name")
    .in("id", ids)) as { data: { id: string; fix_badge: boolean | null; full_name: string }[] | null };

  const cliente = perfis?.find((p) => p.id === req.client_id);
  if (!cliente?.fix_badge) return { ok: false, error: "Sua conta não tem Selo Fix." };

  if (req.provider_id) {
    const prestador = perfis?.find((p) => p.id === req.provider_id);
    if (!prestador?.fix_badge) {
      return {
        ok: false,
        error: `${prestador?.full_name ?? "O prestador"} é uma conta real — o pagamento é obrigatório neste serviço.`,
      };
    }
  }

  const { error } = await admin
    .from("service_requests")
    .update({ no_charge: true, status: "a_caminho" })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/**
 * Consulta o pagamento no gateway (a tela do PIX chama isto de tempo em tempo).
 * Se o gateway já confirmou, promove o pedido — evita que um webhook perdido
 * deixe o cliente travado com o QR na tela.
 */
export async function checkPaymentStatus(
  requestId: string,
): Promise<{ status: "retido" | "pendente" | "recusado" | "desconhecido" }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "desconhecido" };

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, gateway_id, status, request_id, service_requests!inner(client_id)")
    .eq("request_id", requestId)
    .maybeSingle();
  if (!pay) return { status: "desconhecido" };
  const requestOwner = Array.isArray(pay.service_requests)
    ? pay.service_requests[0]
    : pay.service_requests;
  if (!requestOwner || requestOwner.client_id !== user.id) return { status: "desconhecido" };
  if (pay.status === "retido") return { status: "retido" };

  const live = pay.gateway_id ? await fetchChargeStatus(pay.gateway_id as string) : null;
  if (!live) return { status: "pendente" };

  if (live.status === "retido") {
    await admin.from("payments").update({ status: "retido", gateway_status: "retido" }).eq("id", pay.id);
    await admin.from("service_requests").update({ status: "a_caminho" }).eq("id", requestId);
  } else if (live.status === "recusado") {
    await admin.from("payments").update({ gateway_status: "recusado" }).eq("id", pay.id);
  }
  return { status: live.status };
}

/**
 * Contratante APROVA a liberação do adiantamento (parte que o prestador recebe
 * antes de concluir). Só o dono do pedido; exige que já esteja pago (retido).
 * (Simulado, como o resto do pagamento.)
 */
export async function approveAdvance(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, advance_pct, status")
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };
  if (!req.advance_pct || req.advance_pct <= 0) return { ok: false, error: "Este serviço não tem adiantamento." };
  if (!["a_caminho", "em_andamento"].includes(req.status)) return { ok: false, error: "Pague o serviço antes de liberar o adiantamento." };

  await supabase.from("service_requests").update({ advance_approved: true }).eq("id", requestId);

  // marca no pagamento para o adiantamento APARECER na carteira do prestador
  // (era a reclamação "liberei um adiantamento, mas não apareceu nos ganhos")
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, gateway_id, advance_amount, advance_released_at")
    .eq("request_id", requestId)
    .maybeSingle();
  if (pay && !pay.advance_released_at) {
    try {
      if (pay.gateway_id) await releaseAdvance(pay.gateway_id, Number(pay.advance_amount ?? 0));
    } catch { /* no mock não há o que liberar */ }
    await admin
      .from("payments")
      .update({ advance_released_at: new Date().toISOString() })
      .eq("id", pay.id);
  }
  return { ok: true };
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
    .select("gateway_id, method")
    .eq("request_id", requestId)
    .maybeSingle();

  try {
    if (pay?.gateway_id) await releaseEscrow(pay.gateway_id);
  } catch { /* ignora falha de liberacao no mock */ }

  // `available_at` = quando o valor liberado fica sacável (prazo do gateway).
  // É o que alimenta o "seu pagamento cai dia X" na carteira do prestador.
  const now = new Date();
  await admin
    .from("payments")
    .update({
      status: "liberado",
      released_at: now.toISOString(),
      available_at: settlementDate((pay?.method as PayMethod) ?? "pix", now).toISOString(),
    })
    .eq("request_id", requestId);
  await supabase.from("service_requests").update({ status: "concluido" }).eq("id", requestId);

  /**
   * Concluir recalcula a nota do profissional (trigger `on_request_completed`),
   * e é aí que o Selo Fixly pode entrar ou cair. Este é o único momento natural
   * para avisar — o Postgres do Supabase não manda e-mail sozinho.
   * Nunca derruba a aprovação: o serviço já foi concluído e o dinheiro liberado.
   */
  try {
    await notifySealChanges();
  } catch (e: any) {
    console.error("[selo] falha ao avisar mudança de selo:", e?.message ?? e);
  }

  return { ok: true };
}

/** Colunas que a política de cancelamento precisa para fechar a conta. */
const CANCEL_FIELDS =
  "id, client_id, provider_id, status, mode, urgent, final_price, estimated_price, travel_fee, created_at, accepted_at, departed_at, started_at";

/**
 * PRÉVIA do cancelamento — a conta ANTES de o cliente confirmar.
 *
 * Existe separada de propósito: a caixa de "Cancelar serviço?" precisa dizer
 * quanto fica retido e quanto volta, com a cláusula que sustenta o número. Um
 * cancelamento que cobra 50% sem avisar antes é reclamação certa (e com razão).
 * Usa a MESMA função pura do cancelamento de verdade, então não há como as duas
 * contas divergirem.
 */
export async function previewCancel(
  requestId: string,
  motivo: MotivoCancelamento = "desisti",
): Promise<{ ok: boolean; error?: string; conta?: ContaCancelamento; prazo?: string; pago?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select(CANCEL_FIELDS)
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("status, method")
    .eq("request_id", requestId)
    .maybeSingle();

  const pago = pay?.status === "retido";
  return {
    ok: true,
    pago,
    conta: contaDoCancelamento(req as any, motivo),
    prazo: prazoDoReembolso(pay?.method as string | null),
  };
}

/**
 * Cancela o pedido/serviço APLICANDO A POLÍTICA (itens 3, 5, 7 e 8).
 *
 * O que mudou em relação à versão anterior, que devolvia sempre 100%:
 *
 *  - a conta vem de `contaDoCancelamento` — retenção de 30% depois do aceite,
 *    50% (ou o frete, o que for maior) depois do deslocamento, frete no no-show
 *    do cliente, nada nos demais casos;
 *  - o estorno no gateway é **parcial** quando a política manda reter. Isso já
 *    era suportado (`refundCharge(id, amount)`), só não era usado;
 *  - **execução já iniciada não vira número automático**: o item 3.4 fala em
 *    "etapa efetivamente executada, apurada mediante evidências". O serviço é
 *    interrompido, o dinheiro fica RETIDO (item 8) e o suporte decide. Inventar
 *    uma porcentagem aqui seria pagar de menos a um e cobrar de mais do outro.
 *
 * A ORDEM importa e não é estética: o gateway é chamado ANTES de marcar o banco.
 * Se o estorno falhar, nada é gravado e o dinheiro não some do mapa.
 */
export async function cancelService(
  requestId: string,
  opts?: { motivo?: MotivoCancelamento; reason?: string },
): Promise<{
  ok: boolean;
  error?: string;
  refunded?: boolean;
  conta?: ContaCancelamento;
  prazo?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select(CANCEL_FIELDS)
    .eq("id", requestId)
    .single();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };
  if (["concluido", "cancelado"].includes(req.status)) return { ok: false, error: "Este serviço não pode ser cancelado." };

  const motivo: MotivoCancelamento = opts?.motivo ?? "desisti";
  const conta = contaDoCancelamento(req as any, motivo);

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, status, gateway_id, amount, method, provider_net")
    .eq("request_id", requestId)
    .maybeSingle();

  let refunded = false;
  const temDinheiroPreso = !!pay && pay.status === "retido";

  if (temDinheiroPreso && !conta.apuracao && conta.reembolso > 0) {
    /**
     * Quanto pedir de volta ao gateway: o reembolso da política, limitado ao
     * que foi realmente cobrado. `amount` é o TOTAL cobrado (serviço + frete +
     * eventual acréscimo do cartão), e a conta da política roda sobre o valor
     * combinado — sem o teto, um arredondamento pediria estorno maior que a
     * cobrança e o gateway recusaria a operação inteira.
     */
    const cobrado = Number(pay!.amount ?? 0) || 0;
    const devolver = Math.min(conta.reembolso, cobrado);
    const integral = devolver >= cobrado - 0.01;

    if (pay!.gateway_id) {
      try {
        await refundCharge(pay!.gateway_id as string, integral ? undefined : devolver);
      } catch (e: any) {
        return { ok: false, error: "Não foi possível estornar o pagamento: " + e.message };
      }
    }

    if (integral) {
      await admin
        .from("payments")
        .update({
          status: "reembolsado",
          refunded_amount: devolver,
          retained_amount: 0,
          cancel_stage: conta.stage,
        })
        .eq("id", pay!.id);
    } else {
      /**
       * Parte ficou retida: ela é do PROFISSIONAL (o item 3.2 chama de
       * compensação pela reserva de agenda), descontada a comissão da
       * plataforma — a mesma regra de qualquer valor que chega até ele.
       * Marcar `liberado` é o que faz esse dinheiro aparecer no saldo dele;
       * deixar `retido` esconderia uma compensação que já está decidida.
       */
      const liquidoDaRetencao = providerNet(conta.retido);
      await admin
        .from("payments")
        .update({
          status: "liberado",
          provider_net: liquidoDaRetencao,
          released_at: new Date().toISOString(),
          available_at: settlementDate((pay!.method as PayMethod) ?? "pix").toISOString(),
          refunded_amount: devolver,
          retained_amount: conta.retido,
          cancel_stage: conta.stage,
        })
        .eq("id", pay!.id);
    }
    refunded = true;
  } else if (temDinheiroPreso && conta.apuracao) {
    // item 8: o valor NÃO se move enquanto a apuração corre
    await admin
      .from("payments")
      .update({ cancel_stage: conta.stage })
      .eq("id", pay!.id);
  }

  await supabase
    .from("service_requests")
    .update({
      status: "cancelado",
      cancel_reason: opts?.reason ?? null,
      cancel_stage: conta.stage,
      cancelled_by: user.id,
    })
    .eq("id", requestId);

  return { ok: true, refunded, conta, prazo: prazoDoReembolso(pay?.method as string | null) };
}

/**
 * CARTEIRA (Apple Pay / Google Pay) — confirmação.
 *
 * O navegador confirma a cobrança com a digital do dono do aparelho e avisa
 * aqui. **Nada do que ele diz é aceito**: o servidor consulta a intenção no
 * Stripe e só grava o pagamento se o próprio Stripe disser `succeeded` e o
 * valor bater com o do pedido. Sem isso, bastaria uma chamada forjada para
 * "pagar" um serviço de graça.
 */
export async function confirmWalletPayment(
  requestId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, status, final_price, estimated_price, advance_pct, provider_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido inválido" };

  const { getStripePaymentIntent } = await import("@/lib/stripe");
  let pi;
  try {
    pi = await getStripePaymentIntent(paymentIntentId);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Não foi possível confirmar o pagamento." };
  }

  if (pi.mapped !== "retido") return { ok: false, error: "O pagamento ainda não foi confirmado." };
  if (pi.requestId && pi.requestId !== requestId) {
    return { ok: false, error: "Este pagamento é de outro pedido." };
  }

  const admin = createAdminClient();
  // idempotente: se o pagamento já foi gravado, não duplica
  const { data: existente } = await admin
    .from("payments")
    .select("id")
    .eq("gateway_id", paymentIntentId)
    .maybeSingle();
  if (existente) return { ok: true };

  const valorServico = Number(req.final_price ?? req.estimated_price ?? 0);
  const metodo: PayMethod = "google_pay"; // a tarifa é a mesma nas duas carteiras
  const breakdown = paymentBreakdown(valorServico, metodo, Number(req.advance_pct ?? 0));

  // o que o Stripe diz ter recebido é a verdade
  if (Math.abs(pi.amount - breakdown.amount) > 0.05) {
    return { ok: false, error: "O valor pago não confere com o do serviço. Fale com o suporte." };
  }

  await admin.from("payments").insert({
    request_id: requestId,
    amount: breakdown.amount,
    fee: breakdown.platformFee,
    gateway_fee: breakdown.gatewayFee,
    provider_net: breakdown.providerNet,
    advance_pct: breakdown.advancePct,
    advance_amount: breakdown.advanceAmount,
    advance_fee: breakdown.advanceFee,
    method: metodo,
    gateway: "stripe",
    gateway_id: paymentIntentId,
    gateway_status: "retido",
    split_mode: "escrow",
    status: "retido",
  });

  await supabase.from("service_requests").update({ status: "a_caminho" }).eq("id", requestId);
  revalidatePath(`/app/contratante/servico/${requestId}`);
  return { ok: true };
}
