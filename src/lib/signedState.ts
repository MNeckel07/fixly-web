import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * `state` assinado para o OAuth do gateway. Impede CSRF: o callback só aceita
 * um state que NÓS emitimos, para aquele usuário, dentro da validade.
 */

const TTL_MINUTES = 15;

function secret(): string {
  const s = process.env.AUTH_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("AUTH_TOKEN_SECRET (ou SUPABASE_SECRET_KEY) não configurada.");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, x: Date.now() + TTL_MINUTES * 60_000 }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readState(state: string | null | undefined): string | null {
  if (!state || !state.includes(".")) return null;
  const [payload, mac] = state.split(".", 2);
  try {
    const expected = Buffer.from(sign(payload), "base64url");
    const got = Buffer.from(mac, "base64url");
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    const { u, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u: string;
      x: number;
    };
    if (!u || typeof x !== "number" || x < Date.now()) return null;
    return u;
  } catch {
    return null;
  }
}
