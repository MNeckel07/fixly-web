"use server";

import { createClient } from "@/lib/supabase/server";
import { searchCategories, isConfident, contentTerms, normalize } from "@/lib/serviceSearch";

export interface SearchCategoryResult {
  slug: string;
  name: string;
  color: string;
  score: number;
}

export interface SearchProviderResult {
  id: string;
  full_name: string;
  handle: string | null;
  rating: number | null;
  jobs_done: number | null;
  avatar_path: string | null;
  specialties: string | null;
  categorySlug: string | null;
  categoryName: string | null;
}

export interface SearchResponse {
  query: string;
  confident: boolean;
  categories: SearchCategoryResult[];
  /** Profissionais que citaram o termo no texto livre (ex.: "piscina"). */
  providers: SearchProviderResult[];
}

/**
 * Busca inteligente do contratante.
 *
 * Duas frentes, porque a intenção do cliente pode não ser uma categoria:
 *  1. CATEGORIA — motor próprio em `lib/serviceSearch` (léxico treinado);
 *  2. PROFISSIONAL — texto livre do prestador (`specialties`, `bio`, `headline`).
 *     É o caso do "piscina": não existe categoria, mas existe quem escreveu
 *     "tratamento de piscina" no cadastro. Antes essa busca não achava ninguém.
 */
export async function searchServices(query: string): Promise<SearchResponse> {
  const q = (query ?? "").trim();
  const empty: SearchResponse = { query: q, confident: false, categories: [], providers: [] };
  if (q.length < 2) return empty;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  // catálogo visível — categoria oculta nunca pode ser resultado
  const { data: cats } = await supabase
    .from("service_categories")
    .select("slug, name, color")
    .eq("hidden", false);
  const catalog = cats ?? [];
  const bySlug = new Map(catalog.map((c: any) => [c.slug, c]));

  const hits = searchCategories(q, { available: catalog.map((c: any) => c.slug), limit: 4 });
  const categories: SearchCategoryResult[] = hits
    .map((h) => {
      const c = bySlug.get(h.slug) as any;
      return c ? { slug: h.slug, name: c.name, color: c.color, score: h.score } : null;
    })
    .filter(Boolean) as SearchCategoryResult[];

  // ── profissionais pelo texto livre ──
  const terms = contentTerms(q);
  let providers: SearchProviderResult[] = [];
  if (terms.length > 0) {
    const or = terms
      .flatMap((t) => [`specialties.ilike.%${t}%`, `bio.ilike.%${t}%`, `headline.ilike.%${t}%`])
      .join(",");
    const { data: provs } = await supabase
      .from("profiles")
      .select("id, full_name, handle, rating, jobs_done, avatar_path, specialties, bio, headline, category:service_categories!profiles_category_id_fkey(name, slug)")
      .eq("role", "prestador")
      .eq("status", "aprovado")
      .or(or)
      .limit(12);

    // reordena: quem casou em `specialties` (o que ele declara fazer) vem antes
    providers = (provs ?? [])
      .map((p: any) => {
        const cat = Array.isArray(p.category) ? p.category[0] : p.category;
        const spec = normalize(p.specialties ?? "");
        const rest = normalize(`${p.bio ?? ""} ${p.headline ?? ""}`);
        const weight =
          terms.filter((t) => spec.includes(t)).length * 3 + terms.filter((t) => rest.includes(t)).length;
        return {
          id: p.id,
          full_name: p.full_name,
          handle: p.handle,
          rating: p.rating,
          jobs_done: p.jobs_done,
          avatar_path: p.avatar_path,
          specialties: p.specialties,
          categorySlug: cat?.slug ?? null,
          categoryName: cat?.name ?? null,
          weight,
        };
      })
      .sort((a, b) => b.weight - a.weight || (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6)
      .map((p) => {
        const { weight: _w, ...rest } = p;
        void _w;
        return rest;
      });
  }

  return { query: q, confident: isConfident(hits), categories, providers };
}
