"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, MapPin, Phone, MessageCircle, Building2, Megaphone, ExternalLink } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";

type Emp = {
  id: string;
  company_name: string;
  handle: string | null;
  specialties: string | null;
  description: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  secondary: string[];
  category: { name: string; slug: string } | null;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function EmpreiteirosDirectory({ empreiteiros }: { empreiteiros: Emp[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = query
    ? empreiteiros.filter(
        (e) =>
          e.company_name.toLowerCase().includes(query) ||
          e.specialties?.toLowerCase().includes(query) ||
          e.category?.name.toLowerCase().includes(query) ||
          e.city?.toLowerCase().includes(query),
      )
    : empreiteiros;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por especialidade, empresa ou cidade..."
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-black/10 outline-none focus:border-primary text-[15px]"
          />
        </div>
        <Link
          href="/app/contratante/empreiteiros/anunciar"
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-black/10 font-medium text-ink hover:bg-black/[0.03]"
        >
          <Megaphone className="h-4 w-4" /> Anunciar minha empresa
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
          <Building2 className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-ink font-medium">Nenhum empreiteiro por aqui ainda</p>
          <p className="text-sm text-gray-light mt-1">Anuncie a sua empresa e apareça para quem procura mão de obra.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-black/5 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink shrink-0">
                  <CategoryIcon slug={e.category?.slug} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{e.company_name}</p>
                  <p className="text-sm text-gray-light">
                    {e.category?.name ?? "Empreiteiro"}{e.city ? ` · ${e.city}` : ""}
                  </p>
                  {e.specialties && <p className="text-sm text-ink mt-1">{e.specialties}</p>}
                  {e.secondary.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {e.secondary.map((s) => (
                        <span key={s} className="text-[11px] font-medium text-gray bg-canvas rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                  {e.description && <p className="text-sm text-gray mt-1">{e.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {e.handle && (
                  <Link
                    href={`/e/${e.handle}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-black/10 text-ink font-semibold text-sm hover:bg-black/[0.03]"
                  >
                    Ver perfil <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                {e.whatsapp && (
                  <a
                    href={`https://wa.me/55${onlyDigits(e.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-success text-white font-semibold text-sm hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                {e.phone && (
                  <a
                    href={`tel:${onlyDigits(e.phone)}`}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-black/10 text-ink font-semibold text-sm hover:bg-black/[0.03]"
                  >
                    <Phone className="h-4 w-4" /> {e.phone}
                  </a>
                )}
                {e.city && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-light self-center">
                    <MapPin className="h-3.5 w-3.5" /> {e.city}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
