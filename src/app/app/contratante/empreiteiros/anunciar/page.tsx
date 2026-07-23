import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { EmpreiteiroForm } from "@/components/empreiteiros/EmpreiteiroForm";

export const dynamic = "force-dynamic";

export default async function AnunciarPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data: cats } = await supabase.from("service_categories").select("id, name, slug").order("name");
  const { data: listing } = await supabase
    .from("empreiteiros")
    .select("id, company_name, category_id, category_ids, handle, specialties, description, city, phone, whatsapp, subscription_active, subscription_until")
    .eq("owner_id", userId)
    .maybeSingle();

  const portfolioUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;
  let photos: { id: string; image_path: string }[] = [];
  if (listing?.id) {
    const { data: ph } = await supabase
      .from("empreiteiro_items")
      .select("id, image_path")
      .eq("empreiteiro_id", listing.id)
      .order("created_at", { ascending: false });
    photos = (ph as any) ?? [];
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/app/contratante/empreiteiros" className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar aos empreiteiros
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">Anunciar minha empresa</h1>
      <p className="text-gray mb-5">Apareça para quem procura mão de obra. Mensalidade, sem comissão por serviço.</p>
      <EmpreiteiroForm
        ownerId={userId}
        categories={(cats as any) ?? []}
        photos={photos}
        portfolioUrlBase={portfolioUrlBase}
        initial={
          listing
            ? {
                id: listing.id ?? null,
                company_name: listing.company_name ?? "",
                category_id: listing.category_id ?? null,
                category_ids: listing.category_ids ?? [],
                handle: listing.handle ?? "",
                specialties: listing.specialties ?? "",
                description: listing.description ?? "",
                city: listing.city ?? "",
                phone: listing.phone ?? "",
                whatsapp: listing.whatsapp ?? "",
                subscription_active: listing.subscription_active ?? false,
                subscription_until: listing.subscription_until ?? null,
              }
            : null
        }
      />
    </div>
  );
}
