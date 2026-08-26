"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Editar o pedido depois de enviado — enquanto ninguém aceitou.
 *
 * Por que só até o aceite: a partir dali existe um profissional que topou
 * aquele serviço, naquele endereço, por aquele preço. Mudar o combinado por
 * baixo dele seria o mesmo que trocar o contrato depois de assinado; daí para
 * frente o ajuste é conversado no chat.
 *
 * O endereço não é gravado direto: vai pela RPC `update_request_location`, que
 * refaz o split "exato x aproximado" da 0026. Escrever na mão aqui vazaria o
 * endereço exato para todos os prestadores que enxergam pedidos abertos.
 */
export async function updateRequest(input: {
  requestId: string;
  description?: string;
  urgent?: boolean;
  address?: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, provider_id, status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido não encontrado." };
  if (req.provider_id) {
    return { ok: false, error: "Este pedido já foi aceito. Combine os ajustes pelo chat com o profissional." };
  }
  if (["concluido", "cancelado"].includes(req.status)) {
    return { ok: false, error: "Este pedido está encerrado." };
  }

  const patch: Record<string, unknown> = {};
  if (input.description !== undefined) {
    const d = input.description.trim();
    if (d.length < 5) return { ok: false, error: "Descreva o serviço com um pouco mais de detalhe." };
    patch.description = d;
  }
  /**
   * `urgent` é o que define o EXPRESS (v13). A MODALIDADE (`mode`) não é
   * mexida aqui de propósito: um pedido de orçamento/reforma continua sendo
   * orçamento mesmo que o cliente marque urgente — o que muda é a pressa, não
   * o fato de precisar de visita técnica.
   */
  if (input.urgent !== undefined) patch.urgent = input.urgent;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("service_requests").update(patch).eq("id", input.requestId);
    if (error) return { ok: false, error: error.message };
  }

  if (input.address !== undefined && input.lat != null && input.lng != null) {
    const { error } = await supabase.rpc("update_request_location", {
      p_request_id: input.requestId,
      p_address: input.address,
      p_lat: input.lat,
      p_lng: input.lng,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/app/contratante/servico/${input.requestId}`);
  return { ok: true };
}
