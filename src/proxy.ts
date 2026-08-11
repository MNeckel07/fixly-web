import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { appRole, pathAllowed } from "@/lib/appRole";

// Next.js 16: o antigo "middleware" agora se chama "proxy" (runtime nodejs).
export async function proxy(request: NextRequest) {
  const role = appRole(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  // No painel, a raiz não é o site: manda direto para /admin.
  if (role === "admin" && pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  /**
   * Barreira entre os ambientes. Responde **404**, não 403: um 403 confirmaria
   * que a rota existe do outro lado. Para quem estiver varrendo o fixly.company
   * atrás de `/admin`, o painel simplesmente não existe.
   */
  if (!pathAllowed(role, pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos e imagens
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
