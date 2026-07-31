import { createBrowserClient } from "@supabase/ssr";
import { readRemember, REMEMBER_MAX_AGE } from "@/lib/session";

/**
 * Cliente Supabase para uso no navegador (Client Components).
 * Usa a chave publishable — todo acesso é limitado pelas políticas de RLS.
 *
 * ## Por que gravamos os cookies à mão (`cookies.getAll/setAll`)
 * O "Ficar conectado" precisa decidir se o cookie de sessão tem `Max-Age` (fica
 * salvo) ou não (morre ao fechar o navegador). Passar `cookieOptions.maxAge`
 * **não** resolve: o `@supabase/ssr` sobrescreve o valor com o default dele
 * (400 dias) depois de espalhar as nossas opções — ver `setCookieOptions` em
 * `dist/main/cookies.js`. Então assumimos a escrita: mesma serialização, mas o
 * `Max-Age` sai só quando o usuário pediu para continuar conectado.
 */

function serialize(
  name: string,
  value: string,
  opts: { maxAge?: number; path?: string; sameSite?: string; secure?: boolean },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  // sem Max-Age = cookie de sessão (o navegador descarta ao fechar)
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure ?? (typeof location !== "undefined" && location.protocol === "https:")) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          return document.cookie
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=");
              const name = eq === -1 ? c : c.slice(0, eq);
              const raw = eq === -1 ? "" : c.slice(eq + 1);
              let value = raw;
              try { value = decodeURIComponent(raw); } catch { /* valor não-encodado */ }
              return { name, value };
            });
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          // lê a preferência a cada gravação: se o usuário acabou de marcar/
          // desmarcar na tela de login, vale a escolha nova
          const remember = readRemember();
          for (const { name, value, options } of cookiesToSet) {
            const removing = options?.maxAge === 0;
            document.cookie = serialize(name, value, {
              path: (options?.path as string) ?? "/",
              sameSite: (options?.sameSite as string) ?? "Lax",
              // remoção precisa de Max-Age=0; fora disso, só persiste se pediram
              maxAge: removing ? 0 : remember ? REMEMBER_MAX_AGE : undefined,
            });
          }
        },
      },
    },
  );
}
