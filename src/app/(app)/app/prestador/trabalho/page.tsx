import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos } from "@/lib/uploads";
import { TrabalhoView } from "@/components/prestador/TrabalhoView";
import { JobSwitcher } from "@/components/prestador/JobSwitcher";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

const ACTIVE = ["aceito", "a_caminho", "em_andamento"];

export default async function TrabalhoPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobParam } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // TODOS os serviços em aberto (Express aceito, orçamento e reforma), para o
  // prestador ver no que está trabalhando agora e alternar entre eles.
  const { data: rows } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, address, lat, lng, estimated_price, final_price, mode, urgent, photos, provider_done_at, no_charge, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(id, full_name, city), location:service_request_locations(address, lat, lng)",
    )
    .eq("provider_id", profile!.id)
    .in("status", ACTIVE)
    .order("created_at", { ascending: false });

  // Serviço aceito = endereço liberado (a RLS de `service_request_locations` é
  // que decide; aqui só preferimos o exato quando ele vem).
  const jobs = (rows ?? []).map((j: any) => {
    const loc = Array.isArray(j.location) ? j.location[0] : j.location;
    return {
      ...j,
      address: loc?.address ?? j.address,
      lat: loc?.lat ?? j.lat,
      lng: loc?.lng ?? j.lng,
      category: Array.isArray(j.category) ? j.category[0] : j.category,
      client: Array.isArray(j.client) ? j.client[0] : j.client,
    };
  });

  // "trabalhando agora" = a caminho / em andamento e ainda não sinalizado pronto
  const current =
    jobs.find((j: any) => j.id === jobParam) ??
    jobs.find((j: any) => ["a_caminho", "em_andamento"].includes(j.status) && !j.provider_done_at) ??
    jobs[0] ??
    null;

  const jobPhotos = current ? await signRequestPhotos(supabase, (current.photos as string[]) ?? []) : [];
  const normalized = current ? { ...current, photos: jobPhotos } : null;

  return (
    <div className="space-y-4">
      {/* pagamento do cliente / aprovação chegam sozinhos */}
      <AutoRefresh seconds={15} />
      {jobs.length > 1 && (
        <JobSwitcher
          jobs={jobs.map((j: any) => ({
            id: j.id,
            status: j.status,
            mode: j.mode,
            providerDone: !!j.provider_done_at,
            categoryName: j.category?.name ?? "Serviço",
            categorySlug: j.category?.slug ?? null,
            clientName: j.client?.full_name ?? "Cliente",
            price: j.final_price ?? j.estimated_price ?? null,
          }))}
          currentId={current?.id ?? null}
        />
      )}

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
    </div>
  );
}
