import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos } from "@/lib/uploads";
import { TrabalhoView } from "@/components/prestador/TrabalhoView";

export const dynamic = "force-dynamic";

export default async function TrabalhoPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const { data: job } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, address, lat, lng, estimated_price, final_price, mode, urgent, photos, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)",
    )
    .eq("provider_id", profile!.id)
    .in("status", ["aceito", "a_caminho", "em_andamento"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jobPhotos = job ? await signRequestPhotos(supabase, (job.photos as string[]) ?? []) : [];
  const normalized = job
    ? {
        ...job,
        photos: jobPhotos,
        category: Array.isArray(job.category) ? job.category[0] : job.category,
        client: Array.isArray(job.client) ? job.client[0] : job.client,
      }
    : null;

  return (
    <TrabalhoView
      job={normalized as any}
      currentUserId={profile!.id}
      providerLoc={
        profile!.lat && profile!.lng
          ? { lat: profile!.lat, lng: profile!.lng }
          : null
      }
      defaultAdvancePct={profile!.advance_pct ?? 0}
    />
  );
}
