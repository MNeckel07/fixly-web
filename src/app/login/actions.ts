"use server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Resolve o identificador de login: se for e-mail, retorna ele mesmo; se for
 * nome de usuário, busca o e-mail correspondente (usado por contas admin).
 */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (!id) return null;
  if (id.includes("@")) return id;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles_private")
    .select("email")
    .ilike("username", id)
    .maybeSingle();
  return data?.email ?? null;
}
