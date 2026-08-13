"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Upload, Trash2, ExternalLink, ImagePlus, User, Wallet, AlertCircle, IdCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { CategoryIcon } from "@/components/ui/icons";
import { QrCard } from "@/components/profiler/QrCard";

type Item = { id: string; image_path: string; caption: string | null };
type Cat = { id: string; name: string; slug: string };

/** Limite do texto do cartão — a frase longa estourava o layout impresso. */
export const CARD_HEADLINE_MAX = 60;

type Form = {
  handle: string;
  headline: string;
  bio: string;
  avatar_path: string | null;
  advance_pct: number;
  card_category_id: string | null;
  card_headline: string;
};

export function ProfilerEditor({
  providerId,
  initial,
  items,
  categories,
  publicUrlBase,
  avatarUrlBase,
  providerName,
  ratingLabel,
  jobsDone,
  elite,
  appUrl,
}: {
  providerId: string;
  initial: Form;
  items: Item[];
  /** Categorias que ELE cadastrou — é entre estas que escolhe a do cartão. */
  categories: Cat[];
  publicUrlBase: string; // ex.: https://xxxx.supabase.co/storage/v1/object/public/portfolio/
  avatarUrlBase: string; // ex.: https://xxxx.supabase.co/storage/v1/object/public/avatars/
  providerName: string;
  ratingLabel: string;
  jobsDone: number;
  elite: boolean;
  appUrl: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState<Form>(initial);
  const [savedHandle, setSavedHandle] = useState(initial.handle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const cardCategory =
    categories.find((c) => c.id === f.card_category_id) ?? categories[0] ?? null;

  /** Há mudança não salva? (o link público só funciona depois de salvar) */
  const dirty =
    f.handle !== initial.handle ||
    f.headline !== initial.headline ||
    f.bio !== initial.bio ||
    f.advance_pct !== initial.advance_pct ||
    f.card_category_id !== initial.card_category_id ||
    f.card_headline !== initial.card_headline;

  async function save() {
    setError("");
    const handle = f.handle.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (handle.length < 3) return setError("O nome de usuário precisa ter ao menos 3 caracteres (letras, números, . _ -).");
    if (f.card_headline.length > CARD_HEADLINE_MAX)
      return setError(`A frase do cartão passa de ${CARD_HEADLINE_MAX} caracteres.`);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        handle,
        headline: f.headline,
        bio: f.bio,
        advance_pct: f.advance_pct,
        card_category_id: f.card_category_id,
        card_headline: f.card_headline.trim() || null,
      })
      .eq("id", providerId);
    setSaving(false);
    if (error) return setError(error.message.includes("duplicate") ? "Esse nome de usuário já está em uso." : error.message);
    setF((p) => ({ ...p, handle }));
    setSavedHandle(handle);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setError("");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${providerId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setAvatarBusy(false); return setError("Erro ao enviar a foto: " + upErr.message); }
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", providerId);
    setAvatarBusy(false);
    if (dbErr) return setError(dbErr.message);
    setF((p) => ({ ...p, avatar_path: path }));
    router.refresh();
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    if (f.avatar_path) await supabase.storage.from("avatars").remove([f.avatar_path]);
    await supabase.from("profiles").update({ avatar_path: null }).eq("id", providerId);
    setAvatarBusy(false);
    setF((p) => ({ ...p, avatar_path: null }));
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
        {/* Foto de perfil */}
        <div>
          <Label>Foto de perfil</Label>
          <div className="flex items-center gap-4">
            {f.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrlBase + f.avatar_path} alt="Sua foto" className="h-16 w-16 rounded-full object-cover border border-black/5" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-canvas flex items-center justify-center text-gray-light">
                <User className="h-7 w-7" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/[0.03]">
                <Upload className="h-4 w-4" /> {avatarBusy ? "Enviando..." : f.avatar_path ? "Trocar" : "Adicionar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
              {f.avatar_path && (
                <button onClick={removeAvatar} disabled={avatarBusy} className="text-sm text-gray hover:text-danger">Remover</button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-light mt-1.5">Aparece nos cards de busca, nas suas propostas e no seu cartão.</p>
        </div>

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

        {/* Adiantamento padrão */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray"><Wallet className="h-4 w-4" /> Adiantamento padrão</span>
            <span className="text-sm font-semibold text-ink">{f.advance_pct}%</span>
          </div>
          <input type="range" min={0} max={50} step={5} value={Math.min(f.advance_pct, 50)} onChange={(e) => setF((p) => ({ ...p, advance_pct: Number(e.target.value) }))} className="w-full accent-[#FFC107] mt-2" />
          <p className="text-xs text-gray-light mt-1">
            Quanto você quer receber <b>antes</b> de concluir (máx <b>50%</b>; o resto sai ao aprovar). Vem pré-preenchido nas suas propostas.
            O contratante precisa <b>aprovar</b> o adiantamento, e quanto mais adiantado, maior a taxa — então você recebe um pouco menos.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={saving}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar"}</Button>
          {/* O link só abre quando o perfil está SALVO: antes, /p/<handle> não
              existe ainda e abria uma página de erro. */}
          {savedHandle && !dirty ? (
            <Link href={`/p/${savedHandle}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary-dark font-medium">
              Ver meu perfil público <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {savedHandle
                ? "Salve as alterações para ver seu perfil público atualizado."
                : "Você precisa salvar seu perfil para poder acessá-lo."}
            </span>
          )}
        </div>
      </div>

      {/* ── Crie seu cartão ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <div className="flex items-start gap-2">
          <IdCard className="h-5 w-5 text-primary-dark shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-ink">Crie seu cartão</h2>
            <p className="text-sm text-gray-light mt-0.5">
              Escolha qual dos seus serviços aparece no cartão e escreva a frase de chamada.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Label>Serviço que aparece no cartão</Label>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-light">
              Você ainda não tem serviços cadastrados. Adicione-os em Perfil.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((c) => {
                const active = (f.card_category_id ?? categories[0]?.id) === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, card_category_id: c.id }))}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition ${
                      active ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray hover:bg-black/[0.02]"
                    }`}
                  >
                    <CategoryIcon slug={c.slug} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <Label>Frase do cartão</Label>
            <span className={`text-xs mb-1.5 ${f.card_headline.length > CARD_HEADLINE_MAX ? "text-danger" : "text-gray-light"}`}>
              {f.card_headline.length}/{CARD_HEADLINE_MAX}
            </span>
          </div>
          <Input
            value={f.card_headline}
            maxLength={CARD_HEADLINE_MAX}
            onChange={(e) => setF((p) => ({ ...p, card_headline: e.target.value }))}
            placeholder={f.headline || "Ex.: Serviço no mesmo dia, com garantia"}
          />
          <p className="text-xs text-gray-light mt-1.5">
            Curta e direta — cabe em uma linha do cartão. Vazio, usamos a sua chamada do perfil.
          </p>
        </div>

        <div className="mt-5">
          {savedHandle && !dirty ? (
            <QrCard
              url={`${appUrl}/p/${savedHandle}`}
              name={providerName}
              handle={savedHandle}
              category={cardCategory?.name}
              headline={f.card_headline || f.headline}
              avatarUrl={f.avatar_path ? avatarUrlBase + f.avatar_path : null}
              elite={elite}
              ratingLabel={ratingLabel}
              jobsDone={jobsDone}
            />
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" /> Salve para gerar o cartão com o QR do seu perfil.
            </p>
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
