import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { parseRemember, REMEMBER_MAX_AGE } from "@/lib/session";

function tooMany(retryAfter: number) {
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Content-Type": "text/plain" },
  });
}

/**
 * Atualiza (refresh) a sessão do Supabase a cada requisição e protege rotas.
 * Chamado pelo proxy.ts (Next.js 16 renomeou middleware -> proxy).
 */
export async function updateSession(request: NextRequest) {
  const ip = clientIp(request.headers);
  const path = request.nextUrl.pathname;

  // Blindagem de flood por IP (best-effort, por instância).
  const flood = rateLimit(`req:${ip}`, 400, 60_000); // 400 req/min por IP
  if (!flood.ok) return tooMany(flood.retryAfter);
  // Telas de autenticação: bem mais restrito (dificulta brute-force/enumeração).
  if (path === "/login" || path.startsWith("/cadastro") || path.startsWith("/recuperar-senha")) {
    const auth = rateLimit(`auth:${ip}`, 60, 60_000); // 60/min por IP
    if (!auth.ok) return tooMany(auth.retryAfter);
  }

  let response = NextResponse.next({ request });

  // "Ficar conectado": desmarcado, a sessão renovada aqui também tem que sair
  // como cookie de sessão (sem Max-Age/Expires), senão o proxy "reconectaria"
  // o usuário que pediu para não ficar conectado.
  const remember = parseRemember(request.headers.get("cookie"));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(remember ? { cookieOptions: { maxAge: REMEMBER_MAX_AGE } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = { ...options };
            if (!remember) {
              delete opts.maxAge;
              delete opts.expires;
            }
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = path.startsWith("/app") || path.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
