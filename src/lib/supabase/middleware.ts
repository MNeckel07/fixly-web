import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

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
  if (path === "/login" || path.startsWith("/cadastro")) {
    const auth = rateLimit(`auth:${ip}`, 60, 60_000); // 60/min por IP
    if (!auth.ok) return tooMany(auth.retryAfter);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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
