import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PedidosBoard } from "@/components/prestador/PedidosBoard";

export const dynamic = "force-dynamic";

export default async function PrestadorHome() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // pedidos abertos na categoria do prestador
  const { data: open } = await supabase
    .from("service_requests")
    .select(
      "id, description, urgent, address, estimated_price, status, lat, lng, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)",
    )
    .in("status", ["buscando", "proposta_enviada"])
    .order("created_at", { ascending: false })
    .limit(20);

  // proposta minha em cada pedido (para exibir meu preço sugerido)
  const { data: myProps } = await supabase
    .from("proposals")
    .select("request_id, price, eta_minutes")
    .eq("provider_id", profile!.id);

  const propMap: Record<string, { price: number; eta: number | null }> = {};
  (myProps ?? []).forEach((p: any) => {
    propMap[p.request_id] = { price: p.price, eta: p.eta_minutes };
  });

  const requests = (open ?? []).map((r: any) => ({
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
