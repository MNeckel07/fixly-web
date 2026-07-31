import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ProfilerEditor } from "@/components/prestador/ProfilerEditor";
import { ProfilerTabs } from "@/components/profiler/ProfilerTabs";
import { providerReputation } from "@/lib/reputation";

export const dynamic = "force-dynamic";

export default async function MeuProfilerPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const rep = providerReputation(profile.rating, profile.jobs_done);

  const publicUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, image_path, caption")
    .eq("provider_id", profile.id)
    .order("created_at", { ascending: false });

  // Serviços que ELE cadastrou (multi) — é entre estes que escolhe o do cartão.
  const { data: pcs } = await supabase
    .from("provider_categories")
    .select("category:service_categories(id, name, slug)")
    .eq("provider_id", profile.id);
  const myCats = (pcs ?? [])
    .map((r: any) => (Array.isArray(r.category) ? r.category[0] : r.category))
    .filter(Boolean);
  if (profile.category_id && !myCats.some((c: any) => c.id === profile.category_id)) {
    const { data: primary } = await supabase
      .from("service_categories")
      .select("id, name, slug")
      .eq("id", profile.category_id)
      .maybeSingle();
    if (primary) myCats.unshift(primary);
  }
  myCats.sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));

  // comunidade: descobrir e seguir outros profissionais
  const { data: others } = await supabase
    .from("profiles")
    .select("id, full_name, handle, rating, jobs_done, bio, city, avatar_path, category:service_categories!profiles_category_id_fkey(name, slug)")
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .neq("id", profile.id)
    .order("rating", { ascending: false });
  const providers = (others ?? []).map((p: any) => ({ ...p, category: Array.isArray(p.category) ? p.category[0] : p.category }));

  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", profile.id);
  const followingIds = (follows ?? []).map((f: any) => f.following_id);

  let feed: any[] = [];
  if (followingIds.length) {
    const { data: posts } = await supabase
      .from("portfolio_items")
      .select("id, image_path, caption, created_at, provider:profiles!portfolio_items_provider_id_fkey(full_name, handle)")
      .in("provider_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(30);
    feed = (posts ?? []).map((p: any) => ({ ...p, provider: Array.isArray(p.provider) ? p.provider[0] : p.provider }));
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="max-w-2xl mx-auto mb-4">
          <h1 className="text-2xl font-bold text-ink">Meu Profiler</h1>
          <p className="text-gray">Seu portfólio público — divulgue e leve clientes até você.</p>
        </div>
        <ProfilerEditor
          providerId={profile.id}
          initial={{
            handle: (profile as any).handle ?? "",
            headline: (profile as any).headline ?? "",
            bio: profile.bio ?? "",
            avatar_path: (profile as any).avatar_path ?? null,
            advance_pct: (profile as any).advance_pct ?? 0,
            card_category_id: (profile as any).card_category_id ?? null,
            card_headline: (profile as any).card_headline ?? "",
          }}
          items={(items as any) ?? []}
          categories={myCats as any}
          publicUrlBase={publicUrlBase}
          avatarUrlBase={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`}
          providerName={profile.full_name}
          ratingLabel={rep.label}
          jobsDone={profile.jobs_done ?? 0}
          elite={rep.elite}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company"}
        />
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-ink mb-1">Comunidade</h2>
        <p className="text-gray mb-4">Siga outros profissionais e acompanhe os trabalhos deles no seu feed.</p>
        <ProfilerTabs providers={providers} currentUserId={profile.id} followingIds={followingIds} feed={feed} publicUrlBase={publicUrlBase} showRequestButton={false} />
      </div>
    </div>
  );
}
