import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SolicitarFlow } from "@/components/contratante/SolicitarFlow";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SolicitarPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();

  const { data: cats } = await supabase
    .from("service_categories")
    .select("*")
    .order("name");
  const categories = (cats as ServiceCategory[]) ?? [];

  const { data: provs } = await supabase
    .from("profiles")
    .select("id, full_name, rating, jobs_done, base_price, lat, lng, category_id, bio")
    .eq("role", "prestador")
    .eq("status", "aprovado");

  return (
    <SolicitarFlow
      categories={categories}
      providers={provs ?? []}
      preselectSlug={cat ?? null}
      client={{
        id: profile!.id,
        name: profile!.full_name,
        lat: profile!.lat,
        lng: profile!.lng,
        city: profile!.city,
      }}
    />
  );
}
