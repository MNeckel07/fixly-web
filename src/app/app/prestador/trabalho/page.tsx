import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { TrabalhoView } from "@/components/prestador/TrabalhoView";

export const dynamic = "force-dynamic";

export default async function TrabalhoPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();

  const { data: job } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, address, lat, lng, estimated_price, final_price, urgent, category:service_categories(name, icon), client:profiles!service_requests_client_id_fkey(full_name, phone, city)",
    )
    .eq("provider_id", profile!.id)
    .in("status", ["aceito", "a_caminho", "em_andamento"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const normalized = job
    ? {
        ...job,
        category: Array.isArray(job.category) ? job.category[0] : job.category,
        client: Array.isArray(job.client) ? job.client[0] : job.client,
      }
    : null;

  return (
    <TrabalhoView
      job={normalized as any}
      providerLoc={
        profile!.lat && profile!.lng
          ? { lat: profile!.lat, lng: profile!.lng }
          : null
      }
    />
  );
}
