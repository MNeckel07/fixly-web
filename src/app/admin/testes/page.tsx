import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { hasPerm } from "@/lib/permissions";
import { PageHeader } from "@/components/admin/StatCard";
import { TestPanel } from "@/components/admin/TestPanel";

export const dynamic = "force-dynamic";

export default async function TestesPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!hasPerm((profile as any)?.permissions, "testes")) redirect("/admin");

  const { data: testAccounts } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_test", true)
    .in("role", ["contratante", "prestador"])
    .order("role");

  const testIds = (testAccounts ?? []).filter((a: any) => a.role === "contratante").map((a: any) => a.id);

  let services: any[] = [];
  if (testIds.length) {
    const { data } = await supabase
      .from("service_requests")
      .select("id, description, status, estimated_min, estimated_max, final_price, rating, created_at, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name)")
      .in("client_id", testIds)
      .order("created_at", { ascending: false })
      .limit(20);
    services = (data ?? []).map((s: any) => ({
      ...s,
      category: Array.isArray(s.category) ? s.category[0] : s.category,
      provider: Array.isArray(s.provider) ? s.provider[0] : s.provider,
    }));
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHeader title="Modo de Teste" subtitle="Entre como as contas de teste e force cada etapa do fluxo." />
      <TestPanel accounts={(testAccounts as any) ?? []} services={services} />
    </div>
  );
}
