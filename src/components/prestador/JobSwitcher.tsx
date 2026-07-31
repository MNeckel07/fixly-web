"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { brl } from "@/lib/pricing";

type Item = {
  id: string;
  status: string;
  mode: string | null;
  providerDone: boolean;
  categoryName: string;
  categorySlug: string | null;
  clientName: string;
  price: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  aceito: "aguardando pagamento",
  a_caminho: "a caminho",
  em_andamento: "em andamento",
};

/** Alterna entre os serviços em aberto do prestador (Express, orçamento, reforma). */
export function JobSwitcher({ jobs, currentId }: { jobs: Item[]; currentId: string | null }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
        <Briefcase className="h-4 w-4" /> Seus serviços em aberto
        <span className="ml-auto text-xs font-normal text-gray-light">{jobs.length}</span>
      </p>
      <div className="space-y-2">
        {jobs.map((j) => {
          const active = j.id === currentId;
          return (
            <Link
              key={j.id}
              href={`/app/prestador/trabalho?job=${j.id}`}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                active ? "border-primary bg-primary/5" : "border-black/10 hover:bg-black/[0.02]"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
                <CategoryIcon slug={j.categorySlug} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-ink">{j.categoryName}</span>
                  {j.mode === "orcamento" && (
                    <span className="text-[10px] font-bold text-info bg-info/10 px-1.5 py-0.5 rounded-full">ORÇAMENTO</span>
                  )}
                  {active && <span className="text-[10px] font-bold text-primary-dark">· ATUAL</span>}
                </span>
                <span className="block text-xs text-gray-light truncate">
                  {j.clientName} · {j.providerDone ? "aguardando aprovação" : STATUS_LABEL[j.status] ?? j.status}
                </span>
              </span>
              {j.price != null && <span className="text-sm font-semibold text-ink shrink-0">{brl(j.price)}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
