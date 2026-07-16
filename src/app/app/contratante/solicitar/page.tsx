import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SolicitarFlow } from "@/components/contratante/SolicitarFlow";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SolicitarPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; desc?: string }>;
}) {
  const { cat, desc } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

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

  const { data: rules } = await supabase.from("pricing_rules").select("*");
  const pricingRules: Record<string, any> = {};
  (rules ?? []).forEach((r: any) => (pricingRules[r.category_id] = r));

  return (
    <SolicitarFlow
      categories={categories}
      providers={provs ?? []}
      preselectSlug={cat ?? null}
      initialDescription={desc ?? ""}
      pricingRules={pricingRules}
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
