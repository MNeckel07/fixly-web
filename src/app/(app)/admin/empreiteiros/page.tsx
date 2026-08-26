import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { hasPerm } from "@/lib/permissions";
import { PageHeader } from "@/components/admin/StatCard";
import { AdminEmpreiteiros } from "@/components/admin/AdminEmpreiteiros";

export const dynamic = "force-dynamic";

export default async function AdminEmpreiteirosPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!hasPerm((profile as any)?.permissions, "empreiteiros")) redirect("/admin");

  const { data } = await supabase
    .from("empreiteiros")
    .select("id, company_name, city, phone, subscription_active, subscription_until, category:service_categories(name), owner:profiles!empreiteiros_owner_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  const empreiteiros = (data ?? []).map((e: any) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] : e.category,
    owner: Array.isArray(e.owner) ? e.owner[0] : e.owner,
  }));

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader title="Empreiteiros" subtitle="Anúncios B2B e assinaturas." />
      <AdminEmpreiteiros empreiteiros={empreiteiros} />
    </div>
  );
}
