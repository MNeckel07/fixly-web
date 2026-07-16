import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ProfilerDirectory } from "@/components/contratante/ProfilerDirectory";

export const dynamic = "force-dynamic";

export default async function ProfilerPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, handle, rating, jobs_done, bio, city, category:service_categories!profiles_category_id_fkey(name, slug)")
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .order("rating", { ascending: false });

  const providers = (data ?? []).map((p: any) => ({
    ...p,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Pesquisar Profiler</h1>
      <p className="text-gray mb-5">Veja os profissionais, avaliações e escolha quem quer chamar.</p>
      <ProfilerDirectory providers={providers} />
    </div>
  );
}
