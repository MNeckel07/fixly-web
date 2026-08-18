import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { haversineKm, providerNet } from "@/lib/pricing";
import { signRequestPhotoMap } from "@/lib/uploads";
import { PedidosBoard } from "@/components/prestador/PedidosBoard";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function PrestadorHome() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // categorias que o prestador atende (multi) + a principal
  const { data: pcs } = await supabase
    .from("provider_categories")
    .select("category_id")
    .eq("provider_id", profile.id);
  const myCategoryIds = new Set<string>(
    [...(pcs ?? []).map((p: any) => p.category_id), profile.category_id].filter(Boolean) as string[],
  );

  // ⚠️ `address`, `lat` e `lng` de `service_requests` são APROXIMADOS (0026):
  // região e ponto deslocado. O endereço exato vive em
  // `service_request_locations` e a RLS só libera depois do aceite.
  const { data: open } = await supabase
    .from("service_requests")
    .select(
      "id, description, urgent, address, estimated_price, estimated_min, estimated_max, status, lat, lng, photos, category_id, target_provider_id, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city, fix_badge)",
    )
    .in("status", ["buscando", "proposta_enviada"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: myProps } = await supabase
    .from("proposals")
    .select("id, request_id, price, eta_minutes, advance_pct, counter_price, counter_status, counter_by")
    .eq("provider_id", profile.id);

  const propMap: Record<string, {
    id: string; price: number; eta: number | null; advance_pct: number;
    counter_price: number | null; counter_status: string | null; counter_by: string | null;
  }> = {};
  (myProps ?? []).forEach((p: any) => {
    propMap[p.request_id] = {
      id: p.id,
      price: p.price,
      eta: p.eta_minutes,
      advance_pct: p.advance_pct ?? 0,
      counter_price: p.counter_price,
      counter_status: p.counter_status,
      counter_by: p.counter_by,
    };
  });

  // Prestador ocupado = tem serviço em execução AINDA não sinalizado como pronto.
  // Depois de concluir, ele volta a receber pedidos mesmo que a aprovação do
  // contratante (que libera o pagamento) ainda não tenha saído.
  const { count: activeCount } = await supabase
    .from("service_requests")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", profile.id)
    .in("status", ["a_caminho", "em_andamento"])
    .is("provider_done_at", null);
  const busy = (activeCount ?? 0) > 0;

  // Orçamentos / reformas já atribuídos a ele (o contratante escolheu o profissional
  // direto). Aparecem aqui também, além da aba Trabalho.
  const { data: mine } = await supabase
    .from("service_requests")
    .select("id, description, status, address, mode, final_price, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city), location:service_request_locations(address)")
    .eq("provider_id", profile.id)
    .in("status", ["aceito", "a_caminho", "em_andamento"])
    .order("created_at", { ascending: false });
  const myJobs = (mine ?? []).map((j: any) => ({
    id: j.id,
    description: j.description,
    status: j.status,
    // serviço já fechado: aqui o endereço completo pode (e deve) aparecer
    address: (Array.isArray(j.location) ? j.location[0] : j.location)?.address ?? j.address,
    mode: j.mode,
    final_price: j.final_price,
    category: Array.isArray(j.category) ? j.category[0] : j.category,
    client: Array.isArray(j.client) ? j.client[0] : j.client,
  }));

  /**
   * Ganho do mês = o que foi LIBERADO neste mês, não o que foi pedido neste mês.
   *
   * Antes a conta filtrava por `created_at` do pedido: um serviço criado em
   * julho e aprovado em agosto não aparecia em nenhum dos dois meses, e o
   * painel mostrava "3 serviços · R$ 0,00" — que foi a reclamação. Quem manda
   * é a data em que o dinheiro virou dele (`payments.released_at`).
   */
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: paidThisMonth } = await supabase
    .from("payments")
    .select("provider_net, released_at, request:service_requests!inner(provider_id)")
    .eq("request.provider_id", profile.id)
    .gte("released_at", monthStart.toISOString());
  const monthNet = (paidThisMonth ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.provider_net ?? 0),
    0,
  );
  const monthLabel = monthStart.toLocaleDateString("pt-BR", { month: "long" });

  const radius = profile.service_radius_km ?? 10;
  const requests = (open ?? [])
    .filter((r: any) => {
      // SELO FIX (mesma regra do `dispatch_request`, 0023): prestador COM selo
      // não enxerga pedido de cliente real — evitaria o cliente receber proposta
      // de conta de vitrine. O contrário é permitido: conta com selo alcança
      // prestador real, e aí a cobrança entra em vigor.
      const cliente = Array.isArray(r.client) ? r.client[0] : r.client;
      if (profile.fix_badge && !cliente?.fix_badge) return false;
      // só categorias que ele atende
      if (myCategoryIds.size > 0 && r.category_id && !myCategoryIds.has(r.category_id)) return false;
      // respeita o raio de atendimento (quando há coordenadas)
      if (profile.lat && profile.lng && r.lat && r.lng) {
        const d = haversineKm({ lat: profile.lat, lng: profile.lng }, { lat: r.lat, lng: r.lng });
        if (d > radius) return false;
      }
      return true;
    })
    .map((r: any) => {
      const cliente = Array.isArray(r.client) ? r.client[0] : r.client;
      return {
        id: r.id,
        description: r.description,
        urgent: r.urgent,
        // região aproximada (o endereço exato só depois do aceite)
        area: r.address || cliente?.city || null,
        estimated_price: r.estimated_price,
        estimated_min: r.estimated_min,
        estimated_max: r.estimated_max,
        lat: r.lat,
        lng: r.lng,
        distanceKm:
          profile.lat && profile.lng && r.lat && r.lng
            ? haversineKm({ lat: profile.lat, lng: profile.lng }, { lat: r.lat, lng: r.lng })
            : null,
        direct: r.target_provider_id === profile.id,
        photos: (r.photos as string[] | null) ?? [],
        category: Array.isArray(r.category) ? r.category[0] : r.category,
        client: cliente,
        myProposal: propMap[r.id] ?? null,
      };
    });

  // assina as fotos (bucket privado) só para quem tem direito de ver
  const signedMap = await signRequestPhotoMap(supabase, requests.flatMap((r) => r.photos));
  for (const r of requests) r.photos = r.photos.map((p: string) => signedMap[p]).filter(Boolean);

  return (
    <>
      {/* pedidos novos e contra-propostas aparecem sem precisar dar F5 */}
      <AutoRefresh seconds={15} />
      <PedidosBoard
      requests={requests}
      myJobs={myJobs as any}
      providerId={profile!.id}
      providerName={profile!.full_name}
      rating={profile!.rating ?? 0}
      jobsDone={profile!.jobs_done ?? 0}
      monthNet={monthNet}
      monthLabel={monthLabel}
      defaultAdvancePct={profile!.advance_pct ?? 0}
      busy={busy}
      />
    </>
  );
}
