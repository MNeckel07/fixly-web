import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { haversineKm } from "@/lib/pricing";
import { PedidosBoard } from "@/components/prestador/PedidosBoard";

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
      "id, description, urgent, address, estimated_price, status, lat, lng, category_id, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)",
    )
    .in("status", ["buscando", "proposta_enviada"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: myProps } = await supabase
    .from("proposals")
    .select("request_id, price, eta_minutes")
    .eq("provider_id", profile.id);

  const propMap: Record<string, { price: number; eta: number | null }> = {};
  (myProps ?? []).forEach((p: any) => {
    propMap[p.request_id] = { price: p.price, eta: p.eta_minutes };
  });

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
      lat: r.lat,
      lng: r.lng,
      category: Array.isArray(r.category) ? r.category[0] : r.category,
      client: Array.isArray(r.client) ? r.client[0] : r.client,
      myProposal: propMap[r.id] ?? null,
    }));

  return (
    <PedidosBoard
      requests={requests}
      providerName={profile!.full_name}
      rating={profile!.rating ?? 5}
      jobsDone={profile!.jobs_done ?? 0}
      basePrice={profile!.base_price ?? 0}
    />
  );
}
