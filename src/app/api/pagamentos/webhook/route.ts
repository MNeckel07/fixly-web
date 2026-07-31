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

  if (!pay) return NextResponse.json({ ok: true, ignored: "pagamento desconhecido" });

  // confere o valor: se não bate com o que cobramos, não promove nada
  if (Math.abs(Number(pay.amount) - payment.amount) > 0.02) {
    await admin.from("payments").update({ gateway_status: `divergencia:${payment.status}` }).eq("id", pay.id);
    return NextResponse.json({ ok: true, warning: "valor divergente" });
  }

  if (payment.mapped === "retido" && pay.status !== "retido") {
    await admin
      .from("payments")
      .update({ status: "retido", gateway_status: payment.status })
      .eq("id", pay.id);
    // pagamento entrou → o serviço pode começar
    await admin
      .from("service_requests")
      .update({ status: "a_caminho" })
      .eq("id", pay.request_id)
      .eq("status", "aceito");
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
