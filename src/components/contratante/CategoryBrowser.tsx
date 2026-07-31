"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Sparkles, Star, ArrowRight, UserSearch } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { searchServices, type SearchResponse } from "@/app/app/contratante/search.actions";
import { providerReputation } from "@/lib/reputation";
import type { ServiceCategory } from "@/lib/types";

const INITIAL = 11;
const avatarBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;

export function CategoryBrowser({ categories }: { categories: ServiceCategory[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    startTransition(async () => {
      const res = await searchServices(q);
      setResult(res);
    });
  }

  function goTo(slug: string) {
    router.push(`/app/contratante/solicitar?cat=${slug}&desc=${encodeURIComponent(query.trim())}`);
  }

  const visible = showAll ? categories : categories.slice(0, INITIAL);
  const top = result?.categories[0];
  const others = result?.categories.slice(1) ?? [];

  return (
    <section>
      {/* Busca inteligente por descrição */}
      <div className="rounded-2xl border border-black/5 bg-white p-4 mb-5">
        <label className="flex items-center gap-2 text-sm font-medium text-ink mb-2">
          <Sparkles className="h-4 w-4 text-primary-dark" /> Não encontrou? Descreva o que você precisa
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
              placeholder="Ex.: minha pia está vazando, quero trocar o piso do banheiro..."
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
            />
          </div>
          <Button onClick={runSearch} loading={pending}>Buscar</Button>
        </div>

        {/* Resultado */}
        {result && !pending && (
          <div className="mt-4">
            {top ? (
              <>
                <p className="text-xs text-gray mb-2">
                  {result.confident ? "Encontramos o serviço certo:" : "Talvez seja um destes:"}
                </p>
                <button
                  onClick={() => goTo(top.slug)}
                  className="w-full flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left hover:bg-primary/10 transition"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${top.color}1A`, color: top.color }}
                  >
                    <CategoryIcon slug={top.slug} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{top.name}</span>
                    <span className="block text-xs text-gray">Pedir este serviço</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary-dark shrink-0" />
                </button>

                {others.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {others.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => goTo(c.slug)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:bg-primary/5 transition"
                      >
                        <CategoryIcon slug={c.slug} className="h-3.5 w-3.5 shrink-0" /> {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3">
                Não achamos uma categoria exata para <b className="text-ink">“{result.query}”</b>
                {result.providers.length > 0
                  ? " — mas há profissionais que fazem esse tipo de serviço:"
                  : ". Tente descrever com outras palavras, ou escolha uma categoria abaixo."}
              </p>
            )}

            {/* Profissionais que citaram o termo no texto livre (ex.: "piscina") */}
            {result.providers.length > 0 && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-xs text-gray mb-2">
                  <UserSearch className="h-3.5 w-3.5" /> Profissionais que mencionam “{result.query}”
                </p>
                <div className="space-y-2">
                  {result.providers.map((p) => {
                    const rep = providerReputation(p.rating, p.jobs_done);
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl border border-black/10 p-3">
                        {p.avatar_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarBase + p.avatar_path} alt={p.full_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                            <CategoryIcon slug={p.categorySlug} className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink text-sm truncate">{p.full_name}</p>
                          <p className="text-xs text-gray-light truncate">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 fill-primary text-primary" /> {rep.label}
                            </span>
                            {p.specialties ? ` · ${p.specialties}` : p.categoryName ? ` · ${p.categoryName}` : ""}
                          </p>
                        </div>
                        {p.handle ? (
                          <Link
                            href={`/p/${p.handle}`}
                            className="shrink-0 inline-flex items-center h-9 px-3 rounded-lg border border-black/10 text-xs font-semibold text-ink hover:bg-black/[0.03]"
                          >
                            Ver perfil
                          </Link>
                        ) : (
                          <Link
                            href={`/app/contratante/solicitar?modo=orcamento${p.categorySlug ? `&cat=${p.categorySlug}` : ""}`}
                            className="shrink-0 inline-flex items-center h-9 px-3 rounded-lg border border-black/10 text-xs font-semibold text-ink hover:bg-black/[0.03]"
                          >
                            Pedir orçamento
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="font-semibold text-ink mb-4">Categorias de serviço</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {visible.map((c) => (
          <Link
            key={c.id}
            href={`/app/contratante/solicitar?cat=${c.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left hover:shadow-[0_8px_28px_-12px_rgba(31,35,41,0.25)] hover:-translate-y-0.5 transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1A`, color: c.color }}>
              <CategoryIcon slug={c.slug} className="h-5 w-5" />
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{c.name}</span>
              <span className="block text-xs text-gray-light">Solicitar serviço</span>
            </span>
          </Link>
        ))}

        {!showAll && categories.length > INITIAL && (
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-black/15 bg-canvas p-4 text-left hover:border-primary hover:bg-primary/5 transition"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink">
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Ver todas</span>
              <span className="block text-xs text-gray-light">+{categories.length - INITIAL} categorias</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
