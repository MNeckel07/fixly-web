import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SolicitarFlow } from "@/components/contratante/SolicitarFlow";
import { OrcamentoFlow } from "@/components/contratante/OrcamentoFlow";
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

  const { data: cats } = await supabase.from("service_categories").select("*").order("name");
  const categories = (cats as ServiceCategory[]) ?? [];

  const clientInfo = {
    id: profile.id,
    name: profile.full_name,
    lat: profile.lat,
    lng: profile.lng,
    city: profile.city,
    address: profile.address,
    addressNumber: profile.address_number,
    complement: profile.complement,
  };

  // Modo Orçamento: escolher um profissional e conversar antes do preço
  if (modo === "orcamento") {
    const { data: provs } = await supabase
      .from("profiles")
      .select("id, full_name, handle, rating, jobs_done, bio, avatar_path, category_id")
      .eq("role", "prestador")
      .eq("status", "aprovado");
    const { data: pcs } = await supabase.from("provider_categories").select("provider_id, category_id");

    const catMap = new Map<string, Set<string>>();
    (pcs ?? []).forEach((r: any) => {
      if (!catMap.has(r.provider_id)) catMap.set(r.provider_id, new Set());
      catMap.get(r.provider_id)!.add(r.category_id);
    });
    const providers = (provs ?? []).map((p: any) => {
      const set = catMap.get(p.id) ?? new Set<string>();
      if (p.category_id) set.add(p.category_id);
      return { ...p, category_ids: Array.from(set) };
    });

    return (
      <OrcamentoFlow
        categories={categories}
        providers={providers}
        preselectSlug={cat ?? null}
        reformaOnly={reforma === "1"}
        client={clientInfo}
      />
    );
  }

  return (
    <SolicitarFlow
      categories={categories}
      preselectSlug={cat ?? null}
      initialDescription={desc ?? ""}
      initialUrgent={modo === "express"}
      reformaOnly={reforma === "1"}
      client={clientInfo}
    />
  );
}
