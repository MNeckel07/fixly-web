import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oauthAuthorizeUrl } from "@/lib/mercadopago";
import { signState } from "@/lib/signedState";

/**
 * Leva o prestador ao Mercado Pago para autorizar o Fixly a cobrar por ele.
 * Com a conta conectada, o pagamento passa a ser SPLIT: a comissão do Fixly
 * (`application_fee`) cai para nós e o resto direto na conta dele.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "prestador" || profile?.status !== "aprovado") {
    return NextResponse.redirect(
      new URL("/app/prestador/ganhos?gateway=sem-permissao", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  if (!process.env.MP_CLIENT_ID || !process.env.MP_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/app/prestador/ganhos?gateway=nao-configurado", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  return NextResponse.redirect(oauthAuthorizeUrl(signState(user.id)));
}
