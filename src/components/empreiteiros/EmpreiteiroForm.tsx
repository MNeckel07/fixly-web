"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, BadgeCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select, FieldGroup as Field } from "@/components/ui/Field";
import { brl } from "@/lib/pricing";

const PLAN_PRICE = 49.9;

type Listing = {
  company_name: string;
  category_id: string | null;
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
}: {
  ownerId: string;
  categories: { id: string; name: string }[];
  initial: Listing | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState<Listing>(
    initial ?? {
      company_name: "",
      category_id: categories[0]?.id ?? null,
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

  async function save() {
    if (!f.company_name.trim()) return setError("Informe o nome da empresa.");
    setError("");
    setSaving(true);
    const { error } = await supabase.from("empreiteiros").upsert(
      {
        owner_id: ownerId,
        company_name: f.company_name,
        category_id: f.category_id,
        specialties: f.specialties,
        description: f.description,
        city: f.city,
        phone: f.phone,
        whatsapp: f.whatsapp,
      },
      { onConflict: "owner_id" },
    );
    setSaving(false);
    if (error) return setError(error.message);
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
        <Field label="Especialidades (texto livre)"><Input value={f.specialties} onChange={set("specialties")} placeholder="Ex.: Alvenaria, acabamento, pequenas reformas" /></Field>
        <Field label="Descrição"><Textarea rows={3} value={f.description} onChange={set("description")} placeholder="Conte sobre a sua equipe e experiência" /></Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Cidade"><Input value={f.city} onChange={set("city")} /></Field>
          <Field label="Telefone"><Input value={f.phone} onChange={set("phone")} placeholder="(11) 90000-0000" /></Field>
          <Field label="WhatsApp"><Input value={f.whatsapp} onChange={set("whatsapp")} placeholder="(11) 90000-0000" /></Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={save} loading={saving}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar anúncio"}</Button>
      </div>
    </div>
  );
}
