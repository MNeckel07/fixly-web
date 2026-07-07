import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { PricingRulesEditor } from "@/components/admin/PricingRulesEditor";

export const dynamic = "force-dynamic";

export default async function PrecificacaoPage() {
  const supabase = await createClient();

  const { data: cats } = await supabase
    .from("service_categories")
    .select("id, slug, name, base_price")
    .order("name");

  const { data: rules } = await supabase.from("pricing_rules").select("*");
  const ruleMap = new Map((rules ?? []).map((r: any) => [r.category_id, r]));

  const rows = (cats ?? []).map((c: any) => {
    const r: any = ruleMap.get(c.id) ?? {};
    return {
      category_id: c.id,
      slug: c.slug,
      name: c.name,
      base_min: Number(r.base_min ?? Math.round(c.base_price * 0.85)),
      base_max: Number(r.base_max ?? Math.round(c.base_price * 1.4)),
      per_km: Number(r.per_km ?? 3.5),
      urgent_multiplier: Number(r.urgent_multiplier ?? 1.4),
    };
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader title="Precificação" subtitle="Configure o pré-orçamento (faixa) por categoria." />
      <PricingRulesEditor rules={rows} />
    </div>
  );
}
