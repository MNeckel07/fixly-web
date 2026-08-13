/**
 * SEPARAÇÃO DE AMBIENTES — site público × painel administrativo
 * ==============================================================
 *
 * O mesmo código roda em DOIS serviços, cada um no seu domínio:
 *
 *   fixly.company  → APP_ROLE=site   → só o produto. `/admin` responde 404.
 *   fixly.fun      → APP_ROLE=admin  → só o painel. `/app/*`, cadastro e os
 *                                      perfis públicos respondem 404.
 *
 * Por que isso é segurança de verdade, e não teatro: **domínios diferentes têm
 * cookies diferentes**. Um XSS no site público não alcança a sessão de um
 * administrador, porque o cookie do fixly.fun não é enviado para o
 * fixly.company. Some-se a isso poder trancar o painel por IP e o fato de a
 * queda de um serviço não derrubar o outro.
 *
 * O que isto NÃO faz (para não criar falsa sensação de segurança): o código do
 * admin continua presente no servidor público, apenas inacessível por rota. E a
 * fronteira que realmente protege os dados continua sendo a RLS do Supabase +
 * `is_admin()` — não o domínio.
 */

export type AppRole = "site" | "admin";

/** Domínios que valem como painel quando `APP_ROLE` não estiver definida. */
const ADMIN_HOSTS = [/(^|\.)fixly\.fun$/i];

/**
 * Qual papel este servidor está exercendo.
 *
 * A variável `APP_ROLE` manda. O host é só rede de segurança para o caso de
 * alguém subir o serviço sem configurá-la — e, por precaução, o padrão é
 * `site`: esquecer a variável nunca deve transformar o site público em painel.
 */
export function appRole(host?: string | null): AppRole {
  const declared = process.env.APP_ROLE?.trim().toLowerCase();
  if (declared === "admin" || declared === "site") return declared;

  const hostname = (host ?? "").split(":")[0];
  if (hostname && ADMIN_HOSTS.some((re) => re.test(hostname))) return "admin";
  return "site";
}

/** Telas de autenticação — existem nos dois ambientes. */
const AUTH_PATHS = ["/login", "/recuperar-senha", "/aguardando"];

/** Prefixos que só fazem sentido no painel. */
const ADMIN_ONLY = ["/admin"];

/**
 * Prefixos que só fazem sentido no site público.
 * `/api/pagamentos` entra aqui de propósito: o webhook do Mercado Pago e o
 * OAuth do split apontam para o domínio do produto. O painel não precisa deles
 * e não deve expô-los.
 */
const SITE_ONLY = ["/app", "/cadastro", "/p/", "/e/", "/api/pagamentos", "/api/carteira"];

/**
 * Este caminho pode ser servido por este papel?
 * A raiz `/` é tratada no proxy (no painel ela redireciona para `/admin`).
 */
export function pathAllowed(role: AppRole, pathname: string): boolean {
  const p = pathname.toLowerCase();

  if (AUTH_PATHS.some((a) => p === a || p.startsWith(a + "/"))) return true;

  if (role === "admin") {
    return !SITE_ONLY.some((s) => p === s.replace(/\/$/, "") || p.startsWith(s));
  }

  return !ADMIN_ONLY.some((a) => p === a || p.startsWith(a + "/"));
}

/** URL pública do painel — usada nas mensagens de "entre pelo outro endereço". */
export function adminUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") ?? "https://fixly.fun";
}

/** URL pública do site — o caminho inverso. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://fixly.company";
}
