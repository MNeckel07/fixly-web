/**
 * "Ficar conectado" — controla se a sessão sobrevive ao fechar o navegador.
 *
 * Como funciona: os cookies de autenticação do Supabase são gravados com
 * `Max-Age` longo quando o usuário marca a opção, e **sem** `Max-Age` quando não
 * marca. Sem `Max-Age`, o cookie é de sessão: o navegador o descarta ao fechar e
 * na próxima visita é preciso entrar de novo.
 *
 * A preferência em si fica num cookie próprio (não sensível, legível pelo JS),
 * porque tanto o cliente quanto o proxy precisam consultá-la ao gravar a sessão.
 */

export const REMEMBER_COOKIE = "fixly_remember";

/** 1 ano — o refresh token do Supabase é renovado a cada acesso. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365;

/** Lê a preferência a partir de uma string de cookies (`document.cookie` ou header). */
export function parseRemember(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return true; // padrão: manter conectado
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REMEMBER_COOKIE}=([^;]*)`));
  return m ? m[1] !== "0" : true;
}

/** No navegador: lê a preferência atual. */
export function readRemember(): boolean {
  if (typeof document === "undefined") return true;
  return parseRemember(document.cookie);
}

/** No navegador: grava a preferência antes de fazer login. */
export function writeRemember(remember: boolean) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; Max-Age=${REMEMBER_MAX_AGE}; SameSite=Lax${secure}`;
}
