import { createClient } from "@/lib/supabase/server";
import { VendasDashboard } from "@/components/admin/VendasDashboard";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_requests")
    .select(
      "id, status, estimated_price, final_price, created_at, urgent, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    price: r.final_price ?? r.estimated_price ?? 0,
    created_at: r.created_at,
    urgent: r.urgent,
    category: (Array.isArray(r.category) ? r.category[0] : r.category)?.name ?? "—",
    provider: (Array.isArray(r.provider) ? r.provider[0] : r.provider)?.full_name ?? null,
  }));

  return <VendasDashboard rows={rows} />;
}
