import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, ShieldCheck, BadgeCheck, Users, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CategoryIcon } from "@/components/ui/icons";
import { QrCard } from "@/components/profiler/QrCard";
import { FollowButton } from "@/components/profiler/FollowButton";

export const dynamic = "force-dynamic";

export default async function ProfilerPublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: prov } = await supabase
    .from("profiles")
    .select("id, full_name, handle, headline, bio, city, rating, jobs_done, category:service_categories!profiles_category_id_fkey(name, slug)")
    .ilike("handle", handle)
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .maybeSingle();

  if (!prov) notFound();

  const category = Array.isArray(prov.category) ? prov.category[0] : prov.category;
  const rating = prov.rating ?? 5;
  const elite = rating >= 4.5;

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, image_path, caption")
    .eq("provider_id", prov.id)
    .order("created_at", { ascending: false });

  const { count: followers } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", prov.id);

  const { data: reviews } = await supabase.rpc("get_provider_reviews", { p_provider: prov.id, p_limit: 6 });

  const { data: { user } } = await supabase.auth.getUser();
  let following = false;
  if (user) {
    const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", prov.id).maybeSingle();
    following = !!f;
  }

  const publicUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const pageUrl = `${appUrl}/p/${prov.handle}`;

  return (
    <div className="min-h-screen bg-canvas">
      {/* topo */}
      <header className="bg-ink text-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-bold">
            Fi<span style={{ color: "#FFC107" }}>x</span>ly
          </Link>
          <Link href="/login" className="text-sm bg-primary text-ink font-semibold rounded-lg px-3 py-1.5">
            Abrir o Fixly
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Cabeçalho do profissional */}
        <div className="bg-white rounded-2xl border border-black/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-canvas text-ink shrink-0">
              <CategoryIcon slug={category?.slug} className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink">{prov.full_name}</h1>
                {elite && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> Selo Fixly
                  </span>
                )}
              </div>
              <p className="text-gray">{category?.name ?? "Profissional"}</p>
              {prov.headline && <p className="text-sm text-ink mt-1">{prov.headline}</p>}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray">
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" /> {rating.toFixed(1)}</span>
                <span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> {prov.jobs_done ?? 0} serviços</span>
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {followers ?? 0} seguidores</span>
                {prov.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {prov.city}</span>}
              </div>
            </div>
          </div>

          {prov.bio && <p className="text-sm text-gray mt-4 leading-relaxed">{prov.bio}</p>}

          <div className="flex flex-wrap gap-2 mt-5">
            <Link
              href={`/app/contratante/solicitar?cat=${category?.slug ?? ""}`}
              className="inline-flex items-center justify-center rounded-xl bg-primary text-ink px-5 h-11 font-semibold hover:bg-primary-dark transition"
            >
              Solicitar serviço
            </Link>
            <FollowButton providerId={prov.id} currentUserId={user?.id ?? null} initialFollowing={following} />
            <QrCard url={pageUrl} name={prov.full_name} handle={prov.handle} category={category?.name} />
          </div>
        </div>

        {/* Portfólio */}
        <div>
          <h2 className="font-semibold text-ink mb-3">Portfólio</h2>
          {(items ?? []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray-light">
              Este profissional ainda não publicou fotos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(items ?? []).map((it: any) => (
                <a key={it.id} href={publicUrlBase + it.image_path} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-white block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrlBase + it.image_path} alt={it.caption ?? ""} className="h-full w-full object-cover hover:scale-105 transition" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Avaliações */}
        {(reviews ?? []).length > 0 && (
          <div>
            <h2 className="font-semibold text-ink mb-3">Avaliações de clientes</h2>
            <div className="space-y-2">
              {(reviews ?? []).map((rv: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-4 w-4 ${n <= rv.rating ? "fill-primary text-primary" : "text-black/15"}`} />
                      ))}
                    </div>
                    {rv.category && <span className="text-xs text-gray-light">· {rv.category}</span>}
                  </div>
                  <p className="text-sm text-gray mt-1.5">“{rv.review}”</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-light py-4">
          Perfil no <Link href="/" className="font-semibold text-ink">Fixly</Link> — serviços com pagamento protegido.
        </p>
      </main>
    </div>
  );
}
