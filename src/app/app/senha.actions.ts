"use server";

import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { issueCode, verifyCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendEmail, verificationCodeEmailHtml, emailProvider } from "@/lib/email";
import { isPasswordStrong } from "@/lib/password";

/** Mostra o código na tela SÓ quando não há provedor de e-mail nenhum. */
const showDevCode = () => !emailProvider() && process.env.EMAIL_DEV_CODES === "1";

/**
 * Troca de senha do usuário LOGADO, com confirmação por e-mail.
 *
 * Mesmo estando logado, exigimos o código: se alguém pegar a sessão (celular
 * destravado, computador compartilhado), não consegue trocar a senha e tomar a
 * conta sem ter acesso ao e-mail. Também pedimos a senha ATUAL.
 */
export async function requestPasswordChangeCode(): Promise<{ ok: boolean; error?: string; email?: string; devCode?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`pwd-change-code:${ip}`, 6, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: `Muitas tentativas. Tente em ${Math.ceil(rl.retryAfter / 60)} min.` };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Não autenticado" };

  const code = await issueCode(user.email, "recuperacao");
  try {
    await sendEmail({
      to: user.email,
      subject: `${code} é o seu código para trocar a senha — Fixly`,
      html: verificationCodeEmailHtml(code, "recuperacao", OTP_TTL_MINUTES),
    });
  } catch (e: any) {
    return { ok: false, error: "Não foi possível enviar o e-mail: " + e.message };
  }
  return { ok: true, email: user.email, ...(showDevCode() ? { devCode: code } : {}) };
}

export async function changePassword(
  currentPassword: string,
  code: string,
  newPassword: string,
  confirm: string,
): Promise<{ ok: boolean; error?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`pwd-change:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Não autenticado" };

  if (!isPasswordStrong(newPassword)) return { ok: false, error: "A nova senha não atende aos requisitos." };
  if (newPassword !== confirm) return { ok: false, error: "A senha e a confirmação não são iguais." };
  if (newPassword === currentPassword) return { ok: false, error: "A nova senha precisa ser diferente da atual." };

  // confere a senha atual (sem trocar a sessão vigente)
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInErr) return { ok: false, error: "Senha atual incorreta." };

  const check = await verifyCode(user.email, "recuperacao", code);
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
