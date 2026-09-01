import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getMercadoPagoPayment, verifyWebhookSignature, isConfigured } from "@/lib/mercadopago";

/**
 * Webhook do Mercado Pago — é o que confirma o PIX.
 *
 * Regras:
 *  - a ASSINATURA é conferida antes de qualquer coisa (`x-signature`). Sem
 *    MP_WEBHOOK_SECRET configurada, a rota recusa: um webhook sem validação
 *    deixaria qualquer um marcar um pedido como pago;
 *  - o valor NUNCA vem do corpo da notificação — consultamos o pagamento na
 *    API do MP pelo id e usamos o que ele responde;
 *  - responde 200 mesmo em caso já processado, para o MP não ficar reenviando.
 *
 * URL para cadastrar no painel do MP:
 *   https://fixly.company/api/pagamentos/webhook
 */
export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "gateway não configurado" }, { status: 503 });
  }

  const url = new URL(req.url);
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const dataId =
    body?.data?.id?.toString() ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  const check = verifyWebhookSignature({
    signature: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId,
  });
  if (!check.ok) {
    /**
     * Recusa registrada: se a `MP_WEBHOOK_SECRET` do Render não for a mesma do
     * painel do Mercado Pago, TODA notificação real morre aqui com 401. O MP
     * tenta algumas vezes e desiste — e do lado de fora fica igual a um
     * webhook que nunca foi cadastrado. Sem esta linha, os dois casos são
     * indistinguíveis (Fixly 12).
     */
    console.warn("[webhook MP] recusado", { motivo: check.reason, dataId });
    return NextResponse.json({ error: `assinatura: ${check.reason}` }, { status: 401 });
  }

  const topic = body?.type ?? body?.topic ?? url.searchParams.get("type");
  if (topic && topic !== "payment") {
    return NextResponse.json({ ok: true, ignored: topic });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignored: "sem id" });

  // fonte da verdade: a API do MP, não o corpo do webhook
  let payment;
  try {
    payment = await getMercadoPagoPayment(dataId);
  } catch (e: any) {
    // 5xx faz o MP tentar de novo mais tarde — é o que queremos numa falha nossa
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, request_id, status, amount")
    .eq("gateway_id", payment.id)
    .maybeSingle();

  /**
   * ⚠️ NENHUM CAMINHO DE "IGNORADO" PODE SER MUDO (Fixly 12).
   *
   * Este `return` respondia 200 e sumia. Se o `gateway_id` gravado na criação
   * não for o mesmo id que o MP manda na notificação, TODO pagamento cai aqui:
   * o dinheiro entra, o webhook responde "ok", o MP considera entregue e o
   * pedido nunca anda. Do lado de fora é idêntico a um webhook que nunca foi
   * chamado — e foi exatamente esse silêncio que custou o diagnóstico.
   *
   * O 200 continua (senão o MP reenvia para sempre um evento que não é nosso),
   * mas agora fica escrito no log do Render com o id que não casou.
   */
  if (!pay) {
    console.warn("[webhook MP] pagamento desconhecido", {
      gatewayId: payment.id,
      status: payment.status,
      valor: payment.amount,
      // a referência é o id do PEDIDO: com ela dá para achar o serviço mesmo
      // quando não existe linha em `payments` (foi o caso em produção)
      requestId: payment.externalReference,
    });
    return NextResponse.json({ ok: true, ignored: "pagamento desconhecido" });
  }

  // confere o valor: se não bate com o que cobramos, não promove nada
  if (Math.abs(Number(pay.amount) - payment.amount) > 0.02) {
    console.warn("[webhook MP] valor divergente", {
      requestId: pay.request_id,
      cobrado: Number(pay.amount),
      pago: payment.amount,
    });
    await admin.from("payments").update({ gateway_status: `divergencia:${payment.status}` }).eq("id", pay.id);
    return NextResponse.json({ ok: true, warning: "valor divergente" });
  }

  if (payment.mapped === "retido" && pay.status !== "retido") {
    await admin
      .from("payments")
      .update({ status: "retido", gateway_status: payment.status })
      .eq("id", pay.id);

    /**
     * Pagamento entrou → o serviço pode começar.
     *
     * ⚠️ O `.eq("status","aceito")` é uma trava proposital (não promover um
     * pedido cancelado, por exemplo), mas um update que casa ZERO linhas não
     * devolve erro nenhum no Supabase. O pagamento ficava marcado como retido
     * e o pedido parado, sem uma linha de log dizendo por quê. Agora o
     * resultado é conferido e o desencontro fica gravado na própria linha do
     * pagamento, onde quem for investigar vai olhar primeiro.
     */
    const { data: promovido } = await admin
      .from("service_requests")
      .update({ status: "a_caminho" })
      .eq("id", pay.request_id)
      .eq("status", "aceito")
      .select("id");

    if (!promovido || promovido.length === 0) {
      console.warn("[webhook MP] pago, mas o pedido não estava em 'aceito'", {
        requestId: pay.request_id,
        gatewayId: payment.id,
      });
      await admin
        .from("payments")
        .update({ gateway_status: `${payment.status}:pedido_nao_promovido` })
        .eq("id", pay.id);
    }
  } else if (payment.mapped === "recusado") {
    await admin.from("payments").update({ gateway_status: payment.status }).eq("id", pay.id);
  } else {
    await admin.from("payments").update({ gateway_status: payment.status }).eq("id", pay.id);
  }

  return NextResponse.json({ ok: true });
}

/** O MP também faz GET de teste na URL configurada. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "fixly-webhook-mercadopago" });
}
