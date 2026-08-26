import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { ProfileCard } from "@/components/shell/ProfileCard";
import { ProfileEditor } from "@/components/shell/ProfileEditor";
import { ServiceAreaEditor } from "@/components/prestador/ServiceAreaEditor";
import { ChangePassword } from "@/components/shell/ChangePassword";
import { MinhasAvaliacoes, type AvaliacaoRecebida } from "@/components/prestador/MinhasAvaliacoes";

export const dynamic = "force-dynamic";

export default async function PerfilPrestador() {
  const { profile } = await getProfile();
  if (!profile) return null;

  /**
   * As avaliações que ELE recebeu — é aqui que mora o botão de contestar.
   * A RLS de `service_requests` já libera o serviço em que ele é o prestador,
   * então não é preciso chave de servidor.
   */
  const supabase = await createClient();
  const { data: avals } = await supabase
    .from("service_requests")
    .select(
      "id, rating, review, created_at, review_dispute, review_dispute_status, review_dispute_note, review_hidden, category:service_categories(name), client:profiles!service_requests_client_id_fkey(full_name)",
    )
    .eq("provider_id", profile.id)
    .not("rating", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const avaliacoes: AvaliacaoRecebida[] = (avals ?? []).map((a: any) => {
    const cat = Array.isArray(a.category) ? a.category[0] : a.category;
    const cli = Array.isArray(a.client) ? a.client[0] : a.client;
    return {
      id: a.id,
      rating: Number(a.rating ?? 0),
      review: a.review,
      created_at: a.created_at,
      category: cat?.name ?? null,
      clientName: cli?.full_name ?? null,
      review_dispute: a.review_dispute,
      review_dispute_status: a.review_dispute_status,
      review_dispute_note: a.review_dispute_note,
      review_hidden: !!a.review_hidden,
    };
  });

  return (
    <div>
      <ProfileCard profile={profile} />
      <ProfileEditor
        profileId={profile.id}
        role="prestador"
        initial={{
          full_name: profile.full_name ?? "",
          city: profile.city ?? "",
          phone: profile.phone ?? "",
          bio: profile.bio ?? "",
          pix_key: profile.pix_key ?? "",
        }}
      />
      <ServiceAreaEditor
        profileId={profile.id}
        initialLat={profile.lat}
        initialLng={profile.lng}
        initialRadius={profile.service_radius_km}
      />
      <div className="max-w-lg mx-auto mt-4">
        <Link
          href="/app/prestador/empreiteiro"
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-5 hover:border-primary/40 transition"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">Sou empreiteiro</span>
            <span className="block text-sm text-gray">
              Tem empresa? Anuncie para quem procura obra inteira.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-light" />
        </Link>
      </div>

      <MinhasAvaliacoes avaliacoes={avaliacoes} />

      <ChangePassword />
    </div>
  );
}
