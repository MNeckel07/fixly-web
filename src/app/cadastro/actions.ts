"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

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
  // Rate limit: como usa a chave de servidor (cria conta confirmada), blinda
  // contra criação em massa. Máx. 5 contas por IP a cada 15 min.
  const ip = clientIp(await headers());
  const rl = rateLimit(`signup:${ip}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return { ok: false, error: `Muitas tentativas de cadastro. Tente novamente em ${Math.ceil(rl.retryAfter / 60)} min.` };
  }

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
