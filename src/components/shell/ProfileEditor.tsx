"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FieldGroup as Field } from "@/components/ui/Field";

export function ProfileEditor({
  profileId,
  role,
  initial,
}: {
  profileId: string;
  role: "contratante" | "prestador" | "admin";
  initial: { full_name: string; city: string; phone: string; bio: string; pix_key: string };
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!f.full_name.trim()) return setError("Informe seu nome.");
    setError("");
    setSaving(true);

    // sem preço-base: quem precifica é o prestador, proposta por proposta
    const profUpdate: any = { full_name: f.full_name, city: f.city };
    if (role === "prestador") profUpdate.bio = f.bio;

    const privUpdate: any = { phone: f.phone };
    if (role === "prestador") privUpdate.pix_key = f.pix_key.trim() || null;

    const { error: e1 } = await supabase.from("profiles").update(profUpdate).eq("id", profileId);
    const { error: e2 } = await supabase.from("profiles_private").update(privUpdate).eq("id", profileId);
    setSaving(false);
    if (e1 || e2) return setError((e1 ?? e2)!.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto mt-4 bg-white rounded-2xl border border-black/5 p-6 space-y-4">
      <h2 className="font-semibold text-ink">Editar dados</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome completo"><Input value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Telefone"><Input value={f.phone} onChange={set("phone")} placeholder="(11) 90000-0000" /></Field>
      </div>
      <Field label="Cidade"><Input value={f.city} onChange={set("city")} /></Field>
      {role === "prestador" && (
        <>
          <Field label="Sobre você (bio)"><Textarea rows={3} value={f.bio} onChange={set("bio")} /></Field>
          <Field label="Chave PIX (é para lá que vai o seu saque)">
            <Input value={f.pix_key} onChange={set("pix_key")} placeholder="CPF, e-mail, telefone ou aleatória" />
          </Field>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={save} loading={saving}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar alterações"}</Button>
    </div>
  );
}
