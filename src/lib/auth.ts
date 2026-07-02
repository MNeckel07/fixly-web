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

  return { userId: user.id, profile: (profile as Profile) ?? null };
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
  if (profile.status !== "aprovado") redirect("/aguardando");
  return profile;
}
