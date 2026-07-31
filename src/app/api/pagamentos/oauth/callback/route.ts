import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { oauthExchangeCode } from "@/lib/mercadopago";
import { readState } from "@/lib/signedState";

/**
 * Retorno do OAuth do Mercado Pago. Troca o `code` pelo token do prestador e
 * guarda em `provider_gateway_accounts` — tabela server-only (RLS ligado, zero
 * policies), porque o token permite cobrar em nome dele.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
  const back = (q: string) => NextResponse.redirect(new URL(`/app/prestador/ganhos?gateway=${q}`, appUrl));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return back("recusado");
  if (!code) return back("sem-codigo");

  const providerId = readState(state);
  if (!providerId) return back("state-invalido");

  try {
    const tok = await oauthExchangeCode(code);
    const admin = createAdminClient();
    await admin.from("provider_gateway_accounts").upsert(
      {
        provider_id: providerId,
        gateway: "mercadopago",
        gateway_user_id: tok.userId,
        access_token: tok.accessToken,
        refresh_token: tok.refreshToken,
        expires_at: tok.expiresAt.toISOString(),
        connected_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );
  } catch {
    return back("falha");
  }
  return back("conectado");
}
