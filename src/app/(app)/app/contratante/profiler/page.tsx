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
    .select("id, full_name, handle, rating, jobs_done, bio, city, avatar_path, seal_active, category:service_categories!profiles_category_id_fkey(name, slug)")
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .order("rating", { ascending: false });

  const providers = (data ?? []).map((p: any) => ({
    ...p,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  }));

  /**
   * MINIATURAS DO PORTFÓLIO NA LISTA (Fixly 13.2).
   *
   * *"colocar foto em miniatura na base dos profiler (...). Temos que abrir
   * para ver as fotos, ou seguir no caso do profiler, vamos deixar uma
   * miniatura com umas 3 fotos ou 4 em baixo deles"*.
   *
   * O problema era de decisão, não de estética: a lista mostrava nome, nota e
   * bio, e o trabalho — a única coisa que se compara de verdade num pedreiro
   * ou num pintor — exigia abrir o perfil de cada um. Com quatro fotos no
   * card, dá para escolher olhando a lista.
   *
   * ⚠️ UMA CONSULTA SÓ, não uma por profissional. Buscar as fotos dentro do
   * `map` seria um N+1 que cresce com o diretório inteiro. Aqui vem o lote
   * recente de todos e o corte de 4 por pessoa é feito na memória.
   */
  const providerIds = providers.map((p: any) => p.id);
  const miniaturas: Record<string, string[]> = {};
  if (providerIds.length > 0) {
    const { data: fotos } = await supabase
      .from("portfolio_items")
      .select("provider_id, image_path, created_at")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(400);
    for (const f of (fotos ?? []) as { provider_id: string; image_path: string }[]) {
      const lista = (miniaturas[f.provider_id] ??= []);
      if (lista.length < 4) lista.push(f.image_path);
    }
  }

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
      <ProfilerTabs providers={providers} currentUserId={userId} followingIds={followingIds} feed={feed} publicUrlBase={publicUrlBase} miniaturas={miniaturas} />
    </div>
  );
}
