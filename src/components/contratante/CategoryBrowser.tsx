"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Sparkles } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { routeCategory } from "@/lib/categoryRouter";
import { brl } from "@/lib/pricing";
import type { ServiceCategory } from "@/lib/types";

const INITIAL = 11;

export function CategoryBrowser({ categories }: { categories: ServiceCategory[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  function findByText() {
    if (!query.trim()) return;
    const { slug, matched } = routeCategory(query);
    const cat = categories.find((c) => c.slug === slug);
    setHint(matched ? `Encontramos: ${cat?.name ?? "profissional"}` : "Vamos encaminhar para os profissionais certos");
    router.push(`/app/contratante/solicitar?cat=${slug}&desc=${encodeURIComponent(query)}`);
  }

  const visible = showAll ? categories : categories.slice(0, INITIAL);

  return (
    <section>
      {/* Busca por descrição (roteamento) */}
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
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), findByText())}
              placeholder="Ex.: minha pia está vazando, preciso trocar o piso da sala..."
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
            />
          </div>
          <Button onClick={findByText}>Buscar</Button>
        </div>
        {hint && <p className="text-xs text-gray mt-2">{hint}</p>}
      </div>

      <h2 className="font-semibold text-ink mb-4">Categorias de serviço</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {visible.map((c) => (
          <Link
            key={c.id}
            href={`/app/contratante/solicitar?cat=${c.slug}`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-white p-5 hover:shadow-[0_8px_28px_-12px_rgba(31,35,41,0.25)] hover:-translate-y-0.5 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-ink" style={{ backgroundColor: `${c.color}1A` }}>
              <CategoryIcon slug={c.slug} className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-ink text-center">{c.name}</span>
            <span className="text-xs text-gray-light">Solicitar serviço</span>
          </Link>
        ))}

        {!showAll && categories.length > INITIAL && (
          <button
            onClick={() => setShowAll(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-canvas p-5 hover:border-primary hover:bg-primary/5 transition"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-ink">
              <Plus className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-ink text-center">Ver todas</span>
            <span className="text-xs text-gray-light">+{categories.length - INITIAL} categorias</span>
          </button>
        )}
      </div>
    </section>
  );
}
