import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * No Next.js 16 `cookies()` é assíncrono — por isso o await.
 * Continua limitado por RLS (usa a chave publishable + sessão do usuário).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component — pode ser ignorado
            // quando há um proxy (middleware) atualizando a sessão.
          }
        },
      },
    },
  );
}

/**
 * Cliente ADMIN (server-only) — usa a chave secret e IGNORA o RLS.
 * Usar APENAS em código de servidor confiável (aprovação de cadastros,
 * seed, operações administrativas). NUNCA importar em Client Components.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY não configurada. Preencha em .env.local para usar operações administrativas.",
    );
  }
  const { createClient: createRawClient } = require("@supabase/supabase-js");
  return createRawClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
