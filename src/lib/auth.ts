import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";
import type { Role } from "./brand";

/** Retorna o usuário autenticado + seu perfil (ou nulos). Server-only. */
export async function getProfile(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return { userId: user.id, profile: null };

  // dados sensíveis do próprio usuário (só o dono e o admin leem)
  const { data: priv } = await supabase
    .from("profiles_private")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, profile: { ...profile, ...(priv ?? {}) } as Profile };
}

/**
 * Garante que o usuário está logado, com o papel esperado e aprovado.
 * Redireciona quando não atende. Retorna o perfil quando ok.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const { userId, profile } = await getProfile();
  if (!userId) redirect("/login");
  if (!profile) redirect("/cadastro");
  if (profile.role !== role) redirect("/login?erro=papel");
  if (profile.active === false) redirect("/login?erro=inativo");
  if (profile.status !== "aprovado") redirect("/aguardando");
  return profile;
}
