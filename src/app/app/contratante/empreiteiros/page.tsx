import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { EmpreiteirosDirectory } from "@/components/empreiteiros/EmpreiteirosDirectory";

export const dynamic = "force-dynamic";

export default async function EmpreiteirosPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("empreiteiros")
    .select("id, company_name, specialties, description, city, phone, whatsapp, category:service_categories(name, slug)")
    .eq("subscription_active", true)
    .order("created_at", { ascending: false });

  const empreiteiros = (data ?? []).map((e: any) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] : e.category,
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Empreiteiros</h1>
      <p className="text-gray mb-5">Quer achar um empreiteiro para a sua obra? Busque e fale direto com a empresa.</p>
      <EmpreiteirosDirectory empreiteiros={empreiteiros} />
    </div>
  );
}
