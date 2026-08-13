import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { providerReputation } from "@/lib/reputation";
import {
  applePkpass,
  googleWalletSaveUrl,
  appleWalletConfigurado,
  googleWalletConfigurado,
  type WalletCard,
} from "@/lib/wallet";

/**
 * Cartão Fixly na carteira do celular.
 *
 *   GET /api/carteira/apple?handle=carlos.eletricista   → baixa o .pkpass
 *   GET /api/carteira/google?handle=carlos.eletricista  → redireciona para o
 *                                                         "Salvar na Carteira"
 *
 * Sem login de propósito: o cartão carrega exatamente o que a página pública
 * `/p/<handle>` já mostra (nome, serviço, avaliação, selo e o link). Nada de
 * telefone, e-mail ou endereço entra num arquivo que a pessoa vai espalhar.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plataforma: string }> },
) {
  const { plataforma } = await params;
  const handle = new URL(req.url).searchParams.get("handle")?.trim();
  if (!handle) return NextResponse.json({ error: "handle não informado" }, { status: 400 });

  const supabase = await createClient();
  const { data: prov } = await supabase
    .from("profiles")
    .select("full_name, handle, headline, card_headline, rating, jobs_done, seal_active, category:service_categories!profiles_category_id_fkey(name)")
    .ilike("handle", handle)
    .eq("role", "prestador")
    .eq("status", "aprovado")
    .maybeSingle();

  if (!prov) return NextResponse.json({ error: "perfil não encontrado" }, { status: 404 });

  const rep = providerReputation(prov.rating, prov.jobs_done, prov.seal_active);
  const categoria = Array.isArray(prov.category) ? prov.category[0] : prov.category;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";

  const card: WalletCard = {
    handle: prov.handle as string,
    name: prov.full_name as string,
    category: categoria?.name ?? null,
    headline: (prov.card_headline as string) || (prov.headline as string) || null,
    ratingLabel: rep.label,
    jobsDone: Number(prov.jobs_done ?? 0),
    elite: rep.elite,
    url: `${appUrl}/p/${prov.handle}`,
  };

  try {
    if (plataforma === "google") {
      if (!googleWalletConfigurado()) {
        return NextResponse.json({ error: "Carteira do Google ainda não configurada." }, { status: 503 });
      }
      return NextResponse.redirect(googleWalletSaveUrl(card));
    }

    if (plataforma === "apple") {
      if (!appleWalletConfigurado()) {
        return NextResponse.json({ error: "Apple Wallet ainda não configurada." }, { status: 503 });
      }
      const pkpass = await applePkpass(card);
      return new NextResponse(new Uint8Array(pkpass), {
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="fixly-${card.handle}.pkpass"`,
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (e: any) {
    // credencial errada/expirada não pode virar erro 500 sem explicação no log
    console.error(`[carteira/${plataforma}] falha ao gerar o cartão:`, e?.message ?? e);
    return NextResponse.json({ error: "Não foi possível gerar o cartão agora." }, { status: 500 });
  }

  return NextResponse.json({ error: "plataforma inválida" }, { status: 404 });
}
