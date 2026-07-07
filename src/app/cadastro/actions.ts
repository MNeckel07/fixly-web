"use server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Cria a conta de autenticação já confirmada (email_confirm), usando a chave de
 * servidor. Assim o cadastro funciona mesmo com "Confirm email" ligado no
 * Supabase — o gate de acesso real é a aprovação do admin (status do perfil).
 */
export async function createAccount(
  email: string,
  password: string,
  fullName: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!email || !password || password.length < 10) {
    return { ok: false, error: "Dados inválidos." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    const already = /registered|already|exists|duplicate/i.test(error.message);
    return { ok: false, error: already ? "Este e-mail já está cadastrado." : error.message };
  }
  return { ok: true, userId: data.user?.id };
}
