"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Upload, Trash2, ExternalLink, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";

type Item = { id: string; image_path: string; caption: string | null };

export function ProfilerEditor({
  providerId,
  initial,
  items,
  publicUrlBase,
}: {
  providerId: string;
  initial: { handle: string; headline: string; bio: string };
  items: Item[];
  publicUrlBase: string; // ex.: https://xxxx.supabase.co/storage/v1/object/public/portfolio/
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function save() {
    setError("");
    const handle = f.handle.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (handle.length < 3) return setError("O nome de usuário precisa ter ao menos 3 caracteres (letras, números, . _ -).");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ handle, headline: f.headline, bio: f.bio })
      .eq("id", providerId);
    setSaving(false);
    if (error) return setError(error.message.includes("duplicate") ? "Esse nome de usuário já está em uso." : error.message);
    setF((p) => ({ ...p, handle }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function upload(files: FileList) {
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${providerId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("portfolio").upload(path, file);
      if (upErr) { setError("Erro ao enviar: " + upErr.message); continue; }
      await supabase.from("portfolio_items").insert({ provider_id: providerId, image_path: path });
    }
    setUploading(false);
    router.refresh();
  }

  async function remove(item: Item) {
    await supabase.storage.from("portfolio").remove([item.image_path]);
    await supabase.from("portfolio_items").delete().eq("id", item.id);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-4">
        <div>
          <Label>Nome de usuário (link público)</Label>
          <div className="flex items-center rounded-xl border border-black/10 px-3 focus-within:border-primary">
            <span className="text-gray-light text-sm">fixly.company/p/</span>
            <input
              value={f.handle}
              onChange={(e) => setF((p) => ({ ...p, handle: e.target.value }))}
              placeholder="seu.nome"
              className="flex-1 py-2.5 px-1 outline-none text-[15px]"
            />
          </div>
        </div>
        <div>
          <Label>Chamada (headline)</Label>
          <Input value={f.headline} onChange={(e) => setF((p) => ({ ...p, headline: e.target.value }))} placeholder="Ex.: Eletricista há 8 anos — atendimento no mesmo dia" />
        </div>
        <div>
          <Label>Sobre você</Label>
          <Textarea rows={3} value={f.bio} onChange={(e) => setF((p) => ({ ...p, bio: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar"}</Button>
          {f.handle && (
            <Link href={`/p/${f.handle}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary-dark font-medium">
              Ver meu perfil público <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Portfólio de fotos</h2>
          <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/[0.03]">
            <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Adicionar fotos"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          </label>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-light">
            <ImagePlus className="h-9 w-9 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm">Adicione fotos dos seus trabalhos para atrair clientes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((it) => (
              <div key={it.id} className="relative group aspect-square rounded-xl overflow-hidden bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrlBase + it.image_path} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => remove(it)}
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
