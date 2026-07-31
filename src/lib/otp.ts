import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Códigos de verificação por e-mail (OTP).
 *
 * Regras de segurança:
 *  - o código NUNCA é gravado em claro — guardamos o sha256;
 *  - validade curta (10 min) e uso único (`consumed_at`);
 *  - máximo de 5 tentativas por código (evita força bruta em 6 dígitos);
 *  - pedir um código novo invalida os anteriores do mesmo e-mail+propósito;
 *  - a tabela `email_codes` tem RLS ligado e ZERO policies: só a service_role
 *    (este módulo, server-only) a enxerga.
 */

export type OtpPurpose = "cadastro" | "recuperacao";

export const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const norm = (email: string) => email.trim().toLowerCase();

/** Código de 6 dígitos com gerador criptográfico (não Math.random). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Emite um código para o e-mail e invalida os anteriores.
 * Retorna o código em claro — quem chama envia por e-mail e descarta.
 */
export async function issueCode(email: string, purpose: OtpPurpose): Promise<string> {
  const admin = createAdminClient();
  const mail = norm(email);

  await admin.rpc("purge_expired_email_codes");
  // um código novo cancela os pendentes do mesmo propósito
  await admin
    .from("email_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", mail)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const code = generateCode();
  const { error } = await admin.from("email_codes").insert({
    email: mail,
    purpose,
    code_hash: hash(code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Confere o código. Em caso de acerto marca como consumido (uso único).
 * `peek` confere sem consumir (usado para revalidar antes de gravar a conta).
 */
export async function verifyCode(
  email: string,
  purpose: OtpPurpose,
  code: string,
  { peek = false }: { peek?: boolean } = {},
): Promise<VerifyResult> {
  const admin = createAdminClient();
  const mail = norm(email);
  const clean = (code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Informe o código de 6 dígitos." };

  const { data: row } = await admin
    .from("email_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("email", mail)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, error: "Nenhum código pendente. Peça um novo código." };
  if (new Date(row.expires_at).getTime() < Date.now())
    return { ok: false, error: "Código expirado. Peça um novo código." };
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await admin.from("email_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: "Muitas tentativas erradas. Peça um novo código." };
  }

  const a = Buffer.from(hash(clean), "hex");
  const b = Buffer.from(row.code_hash, "hex");
  const match = a.length === b.length && timingSafeEqual(a, b);

  if (!match) {
    await admin.from("email_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
    const left = MAX_ATTEMPTS - (row.attempts ?? 0) - 1;
    return {
      ok: false,
      error: left > 0 ? `Código incorreto. Você tem ${left} tentativa(s).` : "Código incorreto. Peça um novo código.",
    };
  }

  if (!peek) {
    await admin.from("email_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  }
  return { ok: true };
}
