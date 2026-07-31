import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Comprovante de "este e-mail foi verificado por código".
 *
 * Por que existe: o cadastro completo (documentos, endereço, categorias) leva
 * mais que os 10 min de validade do código. Então o código é conferido UMA vez
 * e trocado por este comprovante assinado (HMAC), que acompanha o resto do
 * formulário. É opaco e inforjável no cliente — só o servidor assina e lê.
 */

const TTL_MINUTES = 60;

function secret(): string {
  const s = process.env.AUTH_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("AUTH_TOKEN_SECRET (ou SUPABASE_SECRET_KEY) não configurada.");
  return s;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signVerifiedEmail(email: string): string {
  const payload = b64url(
    JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + TTL_MINUTES * 60_000 }),
  );
  return `${payload}.${sign(payload)}`;
}

/** Retorna o e-mail verificado, ou null se o comprovante for inválido/vencido. */
export function readVerifiedEmail(token: string | null | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, mac] = token.split(".", 2);
  try {
    const expected = Buffer.from(sign(payload), "base64url");
    const got = Buffer.from(mac, "base64url");
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    const { e, x } = JSON.parse(unb64url(payload)) as { e: string; x: number };
    if (!e || typeof x !== "number" || x < Date.now()) return null;
    return e;
  } catch {
    return null;
  }
}
