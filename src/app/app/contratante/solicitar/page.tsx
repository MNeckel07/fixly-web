import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SolicitarFlow } from "@/components/contratante/SolicitarFlow";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SolicitarPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; desc?: string; modo?: string; reforma?: string }>;
}) {
  const { cat, desc, modo, reforma } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const { data: cats } = await supabase
    .from("service_categories")
    .select("*")
    .order("name");
  const categories = (cats as ServiceCategory[]) ?? [];

  return (
    <SolicitarFlow
      categories={categories}
      preselectSlug={cat ?? null}
      initialDescription={desc ?? ""}
      initialUrgent={modo === "express"}
      reformaOnly={reforma === "1"}
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
