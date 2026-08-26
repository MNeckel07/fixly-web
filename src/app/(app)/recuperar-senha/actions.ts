"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { issueCode, verifyCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendEmail, verificationCodeEmailHtml, emailProvider } from "@/lib/email";
import { signVerifiedEmail, readVerifiedEmail } from "@/lib/verifiedEmail";
import { isPasswordStrong } from "@/lib/password";

/** Mostra o código na tela SÓ quando não há provedor de e-mail nenhum. */
const showDevCode = () => !emailProvider() && process.env.EMAIL_DEV_CODES === "1";
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

/** Descobre o usuário de auth a partir do e-mail (PII vive em profiles_private). */
async function findUserId(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles_private")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Etapa 1 — envia o código de recuperação.
 *
 * Segurança: responde SEMPRE `ok`, mesmo quando o e-mail não existe. Assim a
 * tela não vira um verificador de "quem tem conta no Fixly" (enumeração de
 * usuários). Se não existir, simplesmente não sai e-mail nenhum.
 */
export async function requestResetCode(email: string): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`reset-code:${ip}`, 6, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: `Muitas tentativas. Tente novamente em ${Math.ceil(rl.retryAfter / 60)} min.` };
  if (!emailOk(email)) return { ok: false, error: "Informe um e-mail válido." };

  const userId = await findUserId(email);
  if (!userId) return { ok: true }; // não revela se existe conta

  const code = await issueCode(email, "recuperacao");
  try {
    await sendEmail({
      to: email.trim().toLowerCase(),
      subject: `${code} é o seu código para redefinir a senha — Fixly`,
      html: verificationCodeEmailHtml(code, "recuperacao", OTP_TTL_MINUTES),
    });
  } catch (e: any) {
    return { ok: false, error: "Não foi possível enviar o e-mail: " + e.message };
  }
  return { ok: true, ...(showDevCode() ? { devCode: code } : {}) };
}

/** Etapa 2 — confere o código e devolve o comprovante para trocar a senha. */
export async function confirmResetCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; error?: string; token?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`reset-verify:${ip}`, 20, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const res = await verifyCode(email, "recuperacao", code);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, token: signVerifiedEmail(email) };
}

/** Etapa 3 — grava a senha nova (exige o comprovante da etapa 2). */
export async function resetPassword(
  email: string,
  token: string,
  password: string,
  passwordConfirm: string,
): Promise<{ ok: boolean; error?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`reset-apply:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const verified = readVerifiedEmail(token);
  if (!verified || verified !== email.trim().toLowerCase()) {
    return { ok: false, error: "Verificação expirada. Peça um código novo." };
  }
  if (!isPasswordStrong(password)) {
    return { ok: false, error: "A senha não atende aos requisitos de segurança." };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: "A senha e a confirmação não são iguais." };
  }

  const userId = await findUserId(verified);
  if (!userId) return { ok: false, error: "Conta não encontrada." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
