"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, ShieldCheck, BadgeCheck, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea, Input, Label } from "@/components/ui/Field";
import { LocationPicker } from "@/components/map/LocationPicker";
import { CategoryIcon } from "@/components/ui/icons";
import { REFORMA_SLUGS } from "@/lib/categoryRouter";
import type { ServiceCategory } from "@/lib/types";

type Prov = {
  id: string;
  full_name: string;
  handle: string | null;
  rating: number | null;
  jobs_done: number | null;
  bio: string | null;
  category_ids: string[];
};
type ClientInfo = { id: string; name: string; lat: number | null; lng: number | null; city: string | null };

const DEFAULT_LOC = { lat: -23.5505, lng: -46.6333 };

export function OrcamentoFlow({
  categories,
  providers,
  preselectSlug,
  reformaOnly = false,
  client,
}: {
  categories: ServiceCategory[];
  providers: Prov[];
  preselectSlug: string | null;
  reformaOnly?: boolean;
  client: ClientInfo;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const preCat = preselectSlug ? categories.find((c) => c.slug === preselectSlug) ?? null : null;

  const [step, setStep] = useState<"categoria" | "detalhes" | "profissionais">(preCat ? "detalhes" : "categoria");
  const [category, setCategory] = useState<ServiceCategory | null>(preCat);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number }>(client.lat && client.lng ? { lat: client.lat, lng: client.lng } : DEFAULT_LOC);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const shownCategories = reformaOnly ? categories.filter((c) => REFORMA_SLUGS.includes(c.slug)) : categories;
  const matches = category ? providers.filter((p) => p.category_ids.includes(category.id)) : [];

  async function ask(p: Prov) {
    if (!category) return;
    setBusy(p.id);
    setError("");
    const { data: req, error: reqErr } = await supabase
      .from("service_requests")
      .insert({
        client_id: client.id,
        category_id: category.id,
        provider_id: p.id,
        description: description.trim() || "Solicitação de orçamento (visita técnica)",
        address: [address, houseNumber ? `nº ${houseNumber}` : ""].filter(Boolean).join(", "),
        lat: loc.lat,
        lng: loc.lng,
        mode: "orcamento",
        status: "aceito",
      })
      .select("id")
      .single();
    if (reqErr || !req) {
      setBusy(null);
      return setError("Erro ao pedir orçamento: " + (reqErr?.message ?? ""));
    }
    await supabase.rpc("start_service_chat", { p_request_id: req.id });
    router.push(`/app/contratante/servico/${req.id}`);
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto">
      {step === "categoria" && (
        <Card title={reformaOnly ? "Reforma — qual serviço?" : "Solicitar orçamento"} subtitle="Escolha a categoria (serviços com visita técnica)">
          <div className="grid grid-cols-2 gap-3">
            {shownCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCategory(c); setStep("detalhes"); }}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas text-ink">
                  <CategoryIcon slug={c.slug} className="h-5 w-5" />
                </span>
                <span className="block font-medium text-ink text-sm">{c.name}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "detalhes" && category && (
        <Card title={category.name} subtitle="Conte o que precisa e onde é (o profissional vai até você orçar)">
          <div className="space-y-4">
            <div>
              <Label>O que você precisa? (opcional)</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Quero pintar a sala e dois quartos..." />
            </div>
            <div>
              <Label>Onde será o serviço?</Label>
              <LocationPicker value={loc} onChange={setLoc} onAddress={(a) => setAddress(a)} height={180} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Endereço (rua / referência)</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`Rua — ${client.city ?? "sua cidade"}`} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="123" inputMode="numeric" />
              </div>
            </div>
            <div className="flex gap-2">
              {!preCat && <Button variant="ghost" onClick={() => setStep("categoria")}>← Voltar</Button>}
              <Button fullWidth onClick={() => setStep("profissionais")}>Ver profissionais</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "profissionais" && category && (
        <Card title="Escolha um profissional" subtitle="Converse, combine a visita e receba o orçamento">
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          {matches.length === 0 ? (
            <p className="text-center text-gray py-8">Nenhum profissional dessa categoria disponível no momento.</p>
          ) : (
            <div className="space-y-3">
              {matches.map((p) => {
                const r = p.rating ?? 5;
                const elite = r >= 4.5;
                return (
                  <div key={p.id} className="rounded-xl border border-black/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas font-semibold text-ink shrink-0">
                        {p.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-ink truncate">{p.full_name}</p>
                          {elite && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                              <ShieldCheck className="h-3 w-3" /> Selo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray mt-0.5">
                          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> {r.toFixed(1)}</span>
                          <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> {p.jobs_done ?? 0} serviços</span>
                        </div>
                        {p.bio && <p className="text-sm text-gray mt-1 line-clamp-2">{p.bio}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {p.handle && (
                        <Link href={`/p/${p.handle}`} target="_blank" className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-black/[0.03]">
                          Ver perfil <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <Button className="flex-1" loading={busy === p.id} onClick={() => ask(p)}>Pedir orçamento</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4">
            <Button variant="ghost" onClick={() => setStep("detalhes")}>← Voltar aos detalhes</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 animate-fade-up">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-gray text-sm mt-0.5 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}
