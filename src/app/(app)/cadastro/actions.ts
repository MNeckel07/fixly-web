"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { issueCode, verifyCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendEmail, verificationCodeEmailHtml, emailProvider } from "@/lib/email";
import { signVerifiedEmail, readVerifiedEmail } from "@/lib/verifiedEmail";
import { isPasswordStrong } from "@/lib/password";

/** Mostra o código na tela quando não há e-mail configurado (teste). Nunca ligar em produção real. */
/** Mostra o código na tela SÓ quando não há provedor de e-mail nenhum. */
const showDevCode = () => !emailProvider() && process.env.EMAIL_DEV_CODES === "1";

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

/** Já existe conta de autenticação com este e-mail? */
async function emailTaken(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles_private")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  return !!data;
}

/**
 * ETAPA 1 do cadastro — dados básicos + envio do código de confirmação.
 * Não cria nada ainda: só valida e manda o código para provar que o e-mail é dele.
 */
export async function requestSignupCode(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`signup-code:${ip}`, 6, 15 * 60_000);
  if (!rl.ok) {
    return { ok: false, error: `Muitas tentativas. Tente novamente em ${Math.ceil(rl.retryAfter / 60)} min.` };
  }

  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = (input.phone ?? "").replace(/\D/g, "");

  if (first.length < 2) return { ok: false, error: "Informe seu nome." };
  if (last.length < 2) return { ok: false, error: "Informe seu sobrenome." };
  if (!emailOk(email)) return { ok: false, error: "Informe um e-mail válido." };
  if (phone.length < 10) return { ok: false, error: "Informe um telefone válido com DDD." };
  if (!isPasswordStrong(input.password)) {
    return { ok: false, error: "A senha não atende aos requisitos de segurança." };
  }
  if (input.password !== input.passwordConfirm) {
    return { ok: false, error: "A senha e a confirmação não são iguais." };
  }
  if (await emailTaken(email)) {
    return { ok: false, error: "Este e-mail já está cadastrado. Faça login ou recupere a senha." };
  }

  let code: string;
  try {
    code = await issueCode(email, "cadastro");
  } catch (e: any) {
    return { ok: false, error: "Não foi possível gerar o código: " + e.message };
  }

  try {
    await sendEmail({
      to: email,
      subject: `${code} é o seu código de confirmação — Fixly`,
      html: verificationCodeEmailHtml(code, "cadastro", OTP_TTL_MINUTES),
    });
  } catch (e: any) {
    return { ok: false, error: "Não foi possível enviar o e-mail: " + e.message };
  }

  return { ok: true, ...(showDevCode() ? { devCode: code } : {}) };
}

/** Reenvia o código do cadastro. */
export async function resendSignupCode(email: string): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`signup-resend:${ip}`, 4, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: `Aguarde ${Math.ceil(rl.retryAfter / 60)} min para pedir outro código.` };
  if (!emailOk(email)) return { ok: false, error: "E-mail inválido." };

  const code = await issueCode(email, "cadastro");
  await sendEmail({
    to: email.trim().toLowerCase(),
    subject: `${code} é o seu código de confirmação — Fixly`,
    html: verificationCodeEmailHtml(code, "cadastro", OTP_TTL_MINUTES),
  });
  return { ok: true, ...(showDevCode() ? { devCode: code } : {}) };
}

/**
 * ETAPA 2 — confere o código e devolve um comprovante assinado, que o
 * formulário carrega até o fim (o código em si é consumido aqui).
 */
export async function confirmSignupCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; error?: string; token?: string }> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`signup-verify:${ip}`, 20, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const res = await verifyCode(email, "cadastro", code);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, token: signVerifiedEmail(email) };
}

/**
 * ETAPA 3 — cria a conta de autenticação, já com o e-mail confirmado
 * (confirmado por NÓS, via código). Exige o comprovante da etapa 2:
 * sem ele não se cria conta nenhuma.
 */
export async function createAccount(
  email: string,
  password: string,
  fullName: string,
  verifiedToken?: string,
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

  // o e-mail tem que ser o MESMO que passou pela verificação por código
  const verified = readVerifiedEmail(verifiedToken);
  if (!verified || verified !== email.trim().toLowerCase()) {
    return { ok: false, error: "Confirmação de e-mail expirada. Refaça a verificação do código." };
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
