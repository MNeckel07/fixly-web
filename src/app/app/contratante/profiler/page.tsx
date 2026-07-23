import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ProfilerTabs } from "@/components/profiler/ProfilerTabs";

export const dynamic = "force-dynamic";

export default async function ProfilerPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, handle, rating, jobs_done, bio, city, avatar_path, category:service_categories!profiles_category_id_fkey(name, slug)")
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .order("rating", { ascending: false });

  const providers = (data ?? []).map((p: any) => ({
    ...p,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  }));

  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  const followingIds = (follows ?? []).map((f: any) => f.following_id);

  let feed: any[] = [];
  if (followingIds.length) {
    const { data: posts } = await supabase
      .from("portfolio_items")
      .select("id, image_path, caption, created_at, provider:profiles!portfolio_items_provider_id_fkey(full_name, handle)")
      .in("provider_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(30);
    feed = (posts ?? []).map((p: any) => ({
      ...p,
      provider: Array.isArray(p.provider) ? p.provider[0] : p.provider,
    }));
  }

  const publicUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Pesquisar Profiler</h1>
      <p className="text-gray mb-5">Veja os profissionais, siga quem gostar e acompanhe os trabalhos no seu feed.</p>
      <ProfilerTabs providers={providers} currentUserId={userId} followingIds={followingIds} feed={feed} publicUrlBase={publicUrlBase} />
    </div>
  );
}
