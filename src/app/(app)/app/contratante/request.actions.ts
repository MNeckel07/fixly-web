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
    .select("id, client_id, provider_id, status, lat, lng")
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

  /**
   * ENDEREÇO SEM COORDENADA NOVA (Fixly 12).
   *
   * Antes, o endereço só era gravado quando vinham `lat` E `lng` junto — ou
   * seja, só se a pessoa tivesse arrastado o pino. Quem entrava para corrigir
   * o complemento ("Ap31" -> "Ap32") digitava, salvava, a tela dizia que deu
   * certo e NADA mudava: a condição caía fora em silêncio. Foi o relato do
   * Fixly 12 ("só o endereço continua o mesmo quando altera").
   *
   * Agora o texto sozinho basta, e o ponto do mapa é preservado. Faz sentido
   * pela própria natureza do que muda: número de apartamento não move a casa
   * de lugar. Trocar a RUA sem confirmar o pino é que seria perigoso — e essa
   * porta é fechada na tela (`EditRequestDialog`), que exige a confirmação no
   * mapa quando a parte do endereço ANTES do complemento muda.
   */
  if (input.address !== undefined) {
    const lat = input.lat ?? (req.lat as number | null);
    const lng = input.lng ?? (req.lng as number | null);
    if (lat == null || lng == null) {
      return { ok: false, error: "Confirme o ponto no mapa para salvar este endereço." };
    }
    const { error } = await supabase.rpc("update_request_location", {
      p_request_id: input.requestId,
      p_address: input.address,
      p_lat: lat,
      p_lng: lng,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/app/contratante/servico/${input.requestId}`);
  // a lista também mostra o endereço; sem isto o card continua com o texto velho
  revalidatePath("/app/contratante");
  return { ok: true };
}

/** Teto de fotos por pedido — o mesmo do formulário de criação. */
const MAX_FOTOS = 8;

/**
 * Acrescenta fotos a um pedido já enviado (Fixly 12: "colocar a opção de
 * colocar mais fotos").
 *
 * O ARQUIVO sobe pelo navegador (é lá que ele existe) e só os CAMINHOS chegam
 * aqui. O append acontece no servidor de propósito: se a tela lesse a lista,
 * concatenasse e gravasse de volta, duas abas abertas se apagariam entre si —
 * a última a salvar venceria com uma lista velha.
 *
 * Vale a mesma janela do resto da edição: enquanto ninguém aceitou. Depois do
 * aceite o profissional já formou preço com o que viu, e foto nova que muda o
 * serviço é conversa no chat.
 */
export async function addRequestPhotos(
  requestId: string,
  novasFotos: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (novasFotos.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, client_id, provider_id, status, photos")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.client_id !== user.id) return { ok: false, error: "Pedido não encontrado." };
  if (req.provider_id) {
    return { ok: false, error: "Este pedido já foi aceito. Mande a foto pelo chat com o profissional." };
  }
  if (["concluido", "cancelado"].includes(req.status)) {
    return { ok: false, error: "Este pedido está encerrado." };
  }

  const atuais = (req.photos as string[] | null) ?? [];
  const juntas = [...atuais, ...novasFotos].slice(0, MAX_FOTOS);

  const { error } = await supabase
    .from("service_requests")
    .update({ photos: juntas })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/contratante/servico/${requestId}`);
  return { ok: true };
}
