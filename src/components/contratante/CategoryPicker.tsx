"use client";

import { useMemo, useState } from "react";
import { Search, LayoutGrid } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { REFORMA_SLUGS } from "@/lib/categoryRouter";
import type { ServiceCategory } from "@/lib/types";

/**
 * Grade de categorias colorida + busca + "Ver todos".
 * Por padrão mostra os serviços em destaque (`featured`); "Ver todos" abre o
 * catálogo completo (menos os ocultos). Em modo reforma, filtra as de obra.
 */
export function CategoryPicker({
  categories,
  onPick,
  reformaOnly = false,
}: {
  categories: ServiceCategory[];
  onPick: (c: ServiceCategory) => void;
  reformaOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const query = q.trim().toLowerCase();

  const base = useMemo(
    () =>
      categories
        .filter((c) => !c.hidden)
        .filter((c) => (reformaOnly ? REFORMA_SLUGS.includes(c.slug) : true)),
    [categories, reformaOnly],
  );

  const hasFeatured = !reformaOnly && base.some((c) => c.featured);
  const list = query
    ? base.filter((c) => c.name.toLowerCase().includes(query))
    : hasFeatured && !showAll
      ? base.filter((c) => c.featured)
      : base;

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar serviço..."
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 hover:border-primary hover:bg-primary/5 transition text-left"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: `${c.color}1A`, color: c.color }}
            >
              <CategoryIcon slug={c.slug} className="h-5 w-5" />
            </span>
            <span className="block font-medium text-ink text-sm">{c.name}</span>
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="text-center text-gray py-6 text-sm">Nenhum serviço com esse nome.</p>
      )}

      {hasFeatured && !query && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-black/15 text-ink text-sm font-medium hover:border-primary hover:bg-primary/5 transition"
        >
          <LayoutGrid className="h-4 w-4" />
          {showAll ? "Mostrar só os principais" : `Ver todos os serviços (+${base.length - base.filter((c) => c.featured).length})`}
        </button>
      )}
    </div>
  );
}
