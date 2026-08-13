"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Foto de perfil — vale para contratante e prestador.
 *
 * O bucket `avatars` é PÚBLICO de propósito (é vitrine, aparece nas propostas e
 * no Profiler); a policy de escrita exige que a pasta seja o id do usuário, por
 * isso o caminho começa com `${profileId}/`.
 */
export function AvatarPicker({
  profileId,
  name,
  avatarPath,
  size = 80,
}: {
  profileId: string;
  name: string;
  avatarPath: string | null;
  size?: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [path, setPath] = useState(avatarPath);

  const url = path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`
    : null;

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return setError("Escolha uma imagem de até 5 MB.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const newPath = `${profileId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(newPath, file, { upsert: true });
    if (upErr) { setBusy(false); return setError("Erro ao enviar a foto: " + upErr.message); }
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: newPath }).eq("id", profileId);
    setBusy(false);
    if (dbErr) return setError(dbErr.message);
    setPath(newPath);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    if (path) await supabase.storage.from("avatars").remove([path]);
    await supabase.from("profiles").update({ avatar_path: null }).eq("id", profileId);
    setBusy(false);
    setPath(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full rounded-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary font-bold text-ink" style={{ fontSize: size / 2.5 }}>
            {name.charAt(0)}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Trocar foto de perfil"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-md ring-1 ring-black/5 hover:bg-canvas disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {path && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition"
        >
          <Trash2 className="h-3 w-3" /> remover foto
        </button>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
