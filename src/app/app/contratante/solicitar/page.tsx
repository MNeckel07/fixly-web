import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SolicitarFlow } from "@/components/contratante/SolicitarFlow";
import { ModalityChooser } from "@/components/contratante/ModalityChooser";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SolicitarPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; desc?: string; modo?: string; reforma?: string; prestador?: string }>;
}) {
  const { cat, desc, modo, reforma, prestador } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // "+ Solicitar" sem modalidade → deixa o contratante escolher express/orçamento
  if (!modo && !cat) {
    return <ModalityChooser />;
  }

  const { data: cats } = await supabase.from("service_categories").select("*").eq("hidden", false).order("name");
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

  // Pedido direcionado a um profissional (veio do Profiler dele)
  let provider: { id: string; name: string; categorySlugs: string[] } | null = null;
  if (prestador) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, category:service_categories!profiles_category_id_fkey(slug)")
      .eq("id", prestador)
      .eq("role", "prestador")
      .eq("status", "aprovado")
      .maybeSingle();
    if (p) {
      /**
       * TODAS as categorias que ele atende — não só a principal.
       * Antes o pedido direto vinha travado na categoria principal: "o Robson
       * faz tudo e só dá para pedir alvenaria". A escolha é do cliente, entre
       * o que aquele profissional realmente faz.
       */
      const { data: pcs } = await supabase
        .from("provider_categories")
        .select("category:service_categories(slug)")
        .eq("provider_id", p.id);
      const principal = Array.isArray(p.category) ? p.category[0] : p.category;
      const slugs = new Set<string>();
      if (principal?.slug) slugs.add(principal.slug);
      (pcs ?? []).forEach((r: any) => {
        const c = Array.isArray(r.category) ? r.category[0] : r.category;
        if (c?.slug) slugs.add(c.slug);
      });
      provider = { id: p.id, name: p.full_name, categorySlugs: [...slugs] };
    }
  }

  // Orçamento e Reforma viraram a MESMA modalidade ("solicitar orçamento para
  // reforma"): serviço com visita técnica, negociado por PROPOSTAS como no
  // Express. `reforma=1` (links antigos) só filtra o catálogo de obra.
  return (
    <SolicitarFlow
      categories={categories}
      preselectSlug={cat ?? null}
      initialDescription={desc ?? ""}
      initialUrgent={modo === "express"}
      reformaOnly={reforma === "1"}
      mode={modo === "orcamento" ? "orcamento" : "express"}
      provider={provider}
      client={clientInfo}
    />
  );
}
