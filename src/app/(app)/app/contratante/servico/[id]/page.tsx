import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos } from "@/lib/uploads";
import { walletPaymentsEnabled } from "@/lib/gateway";
import { ServiceDetail } from "@/components/contratante/ServiceDetail";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { checkPaymentStatus } from "@/app/(app)/app/contratante/pay.actions";

export const dynamic = "force-dynamic";

export default async function ServicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ alcance?: string }>;
}) {
  const { id } = await params;
  const { alcance } = await searchParams;
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  /**
   * RECONCILIAÇÃO DO PAGAMENTO AO ABRIR A TELA (Fixly 12).
   *
   * O relato do dono: pagou em PRODUÇÃO, o dinheiro saiu da conta dele e caiu
   * na conta do Fixly, e o pedido continuou dizendo "aguardando o pagamento".
   *
   * A confirmação oficial é o webhook do Mercado Pago. Só que até aqui a única
   * rede de segurança para um webhook perdido morava dentro do `PixPanel`, num
   * `setInterval` que **só roda enquanto aquela tela está montada e visível**.
   * Quem fechou a aba, pagou pelo celular, ou pagou no cartão que ficou em
   * análise e só foi aprovado depois, não tinha NINGUÉM perguntando ao gateway:
   * o pedido ficava parado para sempre com o dinheiro já recebido.
   *
   * Agora quem abre a tela pergunta. `status = "aceito"` é exatamente o estado
   * travado (proposta aceita, pagamento não reconhecido); em qualquer outro a
   * consulta seria chamada de API à toa. A função já confere dono e valor, e
   * sai barata quando o pagamento não existe.
   *
   * ⚠️ Roda ANTES da leitura do pedido de propósito — se ela promover o status,
   * o `select` abaixo já lê o valor novo e a tela abre certa na primeira vez,
   * em vez de exigir um F5.
   */
  const { data: travado } = await supabase
    .from("service_requests")
    .select("status")
    .eq("id", id)
    .eq("client_id", userId)
    .maybeSingle();
  if (travado?.status === "aceito") {
    try { await checkPaymentStatus(id); } catch { /* gateway fora do ar não pode derrubar a tela */ }
  }

  const { data: svc } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, urgent, address, lat, lng, estimated_price, final_price, travel_fee, mode, rating, review, provider_id, target_provider_id, photos, advance_pct, advance_approved, provider_done_at, no_charge, created_at, accepted_at, departed_at, started_at, cancel_stage, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name, rating, jobs_done, avatar_path, lat, lng, fix_badge), payment:payments(amount, fee, gateway_fee, provider_net, method, status, advance_pct, advance_amount, advance_fee, available_at), location:service_request_locations(address, lat, lng)",
    )
    .eq("id", id)
    .eq("client_id", userId)
    .maybeSingle();

  if (!svc) notFound();

  let conversationId: string | null = null;
  if (svc.provider_id) {
    const { data } = await supabase.rpc("start_service_chat", { p_request_id: id });
    conversationId = (data as string) ?? null;
  }

  // propostas recebidas (enquanto o cliente ainda não escolheu um profissional)
  let proposals: any[] = [];
  if (!svc.provider_id) {
    const { data: props } = await supabase
      .from("proposals")
      .select(
        "id, price, travel_fee, eta_minutes, advance_pct, counter_price, counter_status, counter_by, counter_rounds, provider:profiles!proposals_provider_id_fkey(id, full_name, handle, rating, jobs_done, seal_active, avatar_path, category:service_categories!profiles_category_id_fkey(name, slug))",
      )
      .eq("request_id", id)
      .order("price", { ascending: true });
    proposals = (props ?? []).map((p: any) => {
      const provider = Array.isArray(p.provider) ? p.provider[0] : p.provider;
      return {
        ...p,
        provider: provider ? { ...provider, category: Array.isArray(provider.category) ? provider.category[0] : provider.category } : null,
      };
    });
  }

  const photoUrls = await signRequestPhotos(supabase, (svc.photos as string[]) ?? []);

  // SELO FIX: pular o pagamento exige selo nos DOIS lados. Aqui é só para a
  // tela decidir se mostra o botão — quem manda é a checagem em `skipPayment`.
  const { data: me } = await supabase.from("profiles").select("fix_badge").eq("id", userId).single();
  const provider = Array.isArray(svc.provider) ? svc.provider[0] : svc.provider;
  const canSkipPayment =
    !!me?.fix_badge && (!svc.provider_id || !!(provider as { fix_badge?: boolean } | null)?.fix_badge);

  // O dono do pedido enxerga o endereço EXATO (que mora na tabela privada);
  // `svc.address/lat/lng` são a versão aproximada, mostrada ao prestador.
  const loc = Array.isArray(svc.location) ? svc.location[0] : svc.location;
  const norm = {
    ...svc,
    address: loc?.address ?? svc.address,
    lat: loc?.lat ?? svc.lat,
    lng: loc?.lng ?? svc.lng,
    photos: photoUrls,
    category: Array.isArray(svc.category) ? svc.category[0] : svc.category,
    provider: Array.isArray(svc.provider) ? svc.provider[0] : svc.provider,
    payment: Array.isArray(svc.payment) ? svc.payment[0] : svc.payment,
  };

  return (
    <>
      {/* propostas, contra-propostas e confirmação de pagamento chegam sozinhas */}
      <AutoRefresh seconds={12} />
      <ServiceDetail carteirasAtivas={walletPaymentsEnabled()} semAlcance={alcance === "0"} service={norm as any} currentUserId={userId} conversationId={conversationId} proposals={proposals} canSkipPayment={canSkipPayment} />
    </>
  );
}
