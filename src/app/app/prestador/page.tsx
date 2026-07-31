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

  const { data: open } = await supabase
    .from("service_requests")
    .select(
      "id, description, urgent, address, estimated_price, estimated_min, estimated_max, status, lat, lng, photos, category_id, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)",
    )
    .in("status", ["buscando", "proposta_enviada"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: myProps } = await supabase
    .from("proposals")
    .select("request_id, price, eta_minutes, advance_pct, counter_price, counter_status")
    .eq("provider_id", profile.id);

  const propMap: Record<string, { price: number; eta: number | null; advance_pct: number; counter_price: number | null; counter_status: string | null }> = {};
  (myProps ?? []).forEach((p: any) => {
    propMap[p.request_id] = { price: p.price, eta: p.eta_minutes, advance_pct: p.advance_pct ?? 0, counter_price: p.counter_price, counter_status: p.counter_status };
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
    .select("id, description, status, address, mode, final_price, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)")
    .eq("provider_id", profile.id)
    .in("status", ["aceito", "a_caminho", "em_andamento"])
    .order("created_at", { ascending: false });
  const myJobs = (mine ?? []).map((j: any) => ({
    id: j.id,
    description: j.description,
    status: j.status,
    address: j.address,
    mode: j.mode,
    final_price: j.final_price,
    category: Array.isArray(j.category) ? j.category[0] : j.category,
    client: Array.isArray(j.client) ? j.client[0] : j.client,
  }));

  // Ganho líquido do mês corrente (substitui o antigo "preço-base" no painel)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: doneThisMonth } = await supabase
    .from("service_requests")
    .select("final_price, estimated_price, payment:payments(provider_net)")
    .eq("provider_id", profile.id)
    .eq("status", "concluido")
    .gte("created_at", monthStart.toISOString());
  const monthNet = (doneThisMonth ?? []).reduce((sum: number, j: any) => {
    const pay = Array.isArray(j.payment) ? j.payment[0] : j.payment;
    return sum + Number(pay?.provider_net ?? providerNet(j.final_price ?? j.estimated_price ?? 0));
  }, 0);

  const radius = profile.service_radius_km ?? 10;
  const requests = (open ?? [])
    .filter((r: any) => {
      // só categorias que ele atende
      if (myCategoryIds.size > 0 && r.category_id && !myCategoryIds.has(r.category_id)) return false;
      // respeita o raio de atendimento (quando há coordenadas)
      if (profile.lat && profile.lng && r.lat && r.lng) {
        const d = haversineKm({ lat: profile.lat, lng: profile.lng }, { lat: r.lat, lng: r.lng });
        if (d > radius) return false;
      }
      return true;
    })
    .map((r: any) => ({
      id: r.id,
      description: r.description,
      urgent: r.urgent,
      address: r.address,
      estimated_price: r.estimated_price,
      estimated_min: r.estimated_min,
      estimated_max: r.estimated_max,
      lat: r.lat,
      lng: r.lng,
      photos: (r.photos as string[] | null) ?? [],
      category: Array.isArray(r.category) ? r.category[0] : r.category,
      client: Array.isArray(r.client) ? r.client[0] : r.client,
      myProposal: propMap[r.id] ?? null,
    }));

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
      providerName={profile!.full_name}
      rating={profile!.rating ?? 0}
      jobsDone={profile!.jobs_done ?? 0}
      monthNet={monthNet}
      defaultAdvancePct={profile!.advance_pct ?? 0}
      busy={busy}
      />
    </>
  );
}
