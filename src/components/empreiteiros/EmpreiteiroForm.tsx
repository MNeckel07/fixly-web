"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, BadgeCheck, Clock, ExternalLink, Upload, Trash2, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select, FieldGroup as Field } from "@/components/ui/Field";
import { CategoryIcon } from "@/components/ui/icons";
import { brl } from "@/lib/pricing";

const PLAN_PRICE = 49.9;

type Cat = { id: string; name: string; slug: string };
type Photo = { id: string; image_path: string };

type Listing = {
  id: string | null;
  company_name: string;
  category_id: string | null;
  category_ids: string[];
  handle: string;
  specialties: string;
  description: string;
  city: string;
  phone: string;
  whatsapp: string;
  subscription_active: boolean;
  subscription_until: string | null;
};

export function EmpreiteiroForm({
  ownerId,
  categories,
  initial,
  photos: initialPhotos = [],
  portfolioUrlBase,
}: {
  ownerId: string;
  categories: Cat[];
  initial: Listing | null;
  photos?: Photo[];
  portfolioUrlBase: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState<Listing>(
    initial ?? {
      id: null,
      company_name: "",
      category_id: categories[0]?.id ?? null,
      category_ids: [],
      handle: "",
      specialties: "",
      description: "",
      city: "",
      phone: "",
      whatsapp: "",
      subscription_active: false,
      subscription_until: null,
    },
  );
  const set = (k: keyof Listing) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  function toggleCat(id: string) {
    setF((p) => ({
      ...p,
      category_ids: p.category_ids.includes(id) ? p.category_ids.filter((x) => x !== id) : [...p.category_ids, id],
    }));
  }

  async function save() {
    if (!f.company_name.trim()) return setError("Informe o nome da empresa.");
    setError("");
    setSaving(true);
    const handle = f.handle.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const { data, error } = await supabase
      .from("empreiteiros")
      .upsert(
        {
          owner_id: ownerId,
          company_name: f.company_name,
          category_id: f.category_id,
          category_ids: f.category_ids,
          handle: handle || null,
          specialties: f.specialties,
          description: f.description,
          city: f.city,
          phone: f.phone,
          whatsapp: f.whatsapp,
        },
        { onConflict: "owner_id" },
      )
      .select("id")
      .single();
    setSaving(false);
    if (error) return setError(error.message.includes("duplicate") || error.message.includes("empreiteiros_handle") ? "Esse link (@) já está em uso." : error.message);
    setF((p) => ({ ...p, id: data?.id ?? p.id, handle }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function activate() {
    setSaving(true);
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await supabase
      .from("empreiteiros")
      .update({ subscription_active: true, subscription_until: until.toISOString().slice(0, 10) })
      .eq("owner_id", ownerId);
    setSaving(false);
    setF((p) => ({ ...p, subscription_active: true, subscription_until: until.toISOString().slice(0, 10) }));
    router.refresh();
  }

  async function uploadPhotos(list: FileList) {
    if (!f.id) return setError("Salve o anúncio primeiro para adicionar fotos.");
    setUploading(true);
    setError("");
    for (const file of Array.from(list)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${ownerId}/emp/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("portfolio").upload(path, file);
      if (upErr) { setError("Erro ao enviar: " + upErr.message); continue; }
      await supabase.from("empreiteiro_items").insert({ empreiteiro_id: f.id, image_path: path });
    }
    setUploading(false);
    router.refresh();
  }

  async function removePhoto(ph: Photo) {
    await supabase.storage.from("portfolio").remove([ph.image_path]);
    await supabase.from("empreiteiro_items").delete().eq("id", ph.id);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Assinatura */}
      <div className="bg-ink text-white rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Plano Empreiteiro</p>
            <p className="text-2xl font-bold">{brl(PLAN_PRICE)}<span className="text-sm font-normal text-white/60">/mês</span></p>
            <p className="text-white/60 text-xs mt-1">Sem comissão por serviço — você fala direto com o cliente.</p>
          </div>
          {f.subscription_active ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success bg-success/15 px-3 py-1.5 rounded-full">
              <BadgeCheck className="h-4 w-4" /> Ativo{f.subscription_until ? ` até ${new Date(f.subscription_until).toLocaleDateString("pt-BR")}` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning bg-warning/15 px-3 py-1.5 rounded-full">
              <Clock className="h-4 w-4" /> Inativo
            </span>
          )}
        </div>
        {!f.subscription_active && (
          <Button className="mt-4" onClick={activate} loading={saving}>Ativar assinatura</Button>
        )}
        <p className="text-white/40 text-[11px] mt-2">Pagamento recorrente (Mercado Pago) entra na integração final — por ora a ativação é simulada.</p>
      </div>

      {/* Dados da empresa */}
      <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-4">
        <h2 className="font-semibold text-ink">Dados da empresa</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome da empresa"><Input value={f.company_name} onChange={set("company_name")} /></Field>
          <Field label="Especialidade principal">
            <Select value={f.category_id ?? ""} onChange={set("category_id")}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Outras especialidades (selecione quantas quiser)">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.filter((c) => c.id !== f.category_id).map((c) => {
              const active = f.category_ids.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    active ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray hover:bg-black/[0.02]"
                  }`}
                >
                  <CategoryIcon slug={c.slug} className="h-4 w-4" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Especialidades (texto livre)"><Input value={f.specialties} onChange={set("specialties")} placeholder="Ex.: Alvenaria, acabamento, pequenas reformas" /></Field>

        <Field label="Link público do perfil (@)">
          <div className="flex items-center rounded-xl border border-black/10 px-3 focus-within:border-primary">
            <span className="text-gray-light text-sm">fixly.company/e/</span>
            <input
              value={f.handle}
              onChange={(e) => setF((p) => ({ ...p, handle: e.target.value }))}
              placeholder="minha.empresa"
              className="flex-1 py-2.5 px-1 outline-none text-[15px]"
            />
          </div>
        </Field>

        <Field label="Descrição"><Textarea rows={3} value={f.description} onChange={set("description")} placeholder="Conte sobre a sua equipe e experiência" /></Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Cidade"><Input value={f.city} onChange={set("city")} /></Field>
          <Field label="Telefone"><Input value={f.phone} onChange={set("phone")} placeholder="(11) 90000-0000" /></Field>
          <Field label="WhatsApp"><Input value={f.whatsapp} onChange={set("whatsapp")} placeholder="(11) 90000-0000" /></Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar anúncio"}</Button>
          {f.handle && f.id && (
            <Link href={`/e/${f.handle}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary-dark font-medium">
              Ver meu perfil público <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Fotos da empresa */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Fotos dos trabalhos</h2>
          {f.id && (
            <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/[0.03]">
              <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Adicionar fotos"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
            </label>
          )}
        </div>
        {!f.id ? (
          <p className="text-sm text-gray-light text-center py-6">Salve o anúncio para poder adicionar fotos.</p>
        ) : initialPhotos.length === 0 ? (
          <div className="text-center py-8 text-gray-light">
            <ImagePlus className="h-9 w-9 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm">Mostre obras da sua equipe para atrair clientes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {initialPhotos.map((it) => (
              <div key={it.id} className="relative group aspect-square rounded-xl overflow-hidden bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={portfolioUrlBase + it.image_path} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removePhoto(it)}
                  className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg bg-white/90 text-danger flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
