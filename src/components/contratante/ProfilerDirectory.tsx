"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star, BadgeCheck, ShieldCheck } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { FollowButton } from "@/components/profiler/FollowButton";

type Provider = {
  id: string;
  full_name: string;
  handle: string | null;
  rating: number | null;
  jobs_done: number | null;
  bio: string | null;
  city: string | null;
  category: { name: string; slug: string } | null;
};

export function ProfilerDirectory({
  providers,
  currentUserId = null,
  followingIds = [],
}: {
  providers: Provider[];
  currentUserId?: string | null;
  followingIds?: string[];
}) {
  const followingSet = new Set(followingIds);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = query
    ? providers.filter(
        (p) =>
          p.full_name.toLowerCase().includes(query) ||
          p.category?.name.toLowerCase().includes(query) ||
          p.bio?.toLowerCase().includes(query),
      )
    : providers;

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, categoria ou especialidade..."
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
        />
      </div>

      {list.length === 0 ? (
        <p className="text-center text-gray py-10">Nenhum profissional encontrado.</p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const rating = p.rating ?? 5;
            const elite = rating >= 4.5;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink shrink-0">
                    <CategoryIcon slug={p.category?.slug} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-ink">{p.full_name}</p>
                      {elite && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="h-3 w-3" /> Selo Fixly
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-light">{p.category?.name ?? "Profissional"}{p.city ? ` · ${p.city}` : ""}</p>
                    {p.bio && <p className="text-sm text-gray mt-1 line-clamp-2">{p.bio}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {rating.toFixed(1)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" /> {p.jobs_done ?? 0} serviços
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 items-stretch">
                  {p.handle && (
                    <Link
                      href={`/p/${p.handle}`}
                      target="_blank"
                      className="flex-1 inline-flex items-center justify-center h-10 rounded-xl border border-black/10 text-ink font-semibold text-sm hover:bg-black/[0.03] transition"
                    >
                      Ver portfólio
                    </Link>
                  )}
                  <Link
                    href={`/app/contratante/solicitar?cat=${p.category?.slug ?? ""}`}
                    className="flex-1 inline-flex items-center justify-center h-10 rounded-xl bg-primary text-ink font-semibold text-sm hover:bg-primary-dark transition"
                  >
                    Solicitar
                  </Link>
                  <span className="[&>*]:!h-10">
                    <FollowButton providerId={p.id} currentUserId={currentUserId} initialFollowing={followingSet.has(p.id)} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
