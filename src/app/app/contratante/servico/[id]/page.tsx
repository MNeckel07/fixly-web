import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos } from "@/lib/uploads";
import { ServiceDetail } from "@/components/contratante/ServiceDetail";

export const dynamic = "force-dynamic";

export default async function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data: svc } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, urgent, address, lat, lng, estimated_price, final_price, mode, rating, review, provider_id, photos, advance_pct, created_at, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name, rating, jobs_done, avatar_path, lat, lng), payment:payments(amount, fee, gateway_fee, provider_net, method, status, advance_pct, advance_amount, advance_fee)",
    )
    .eq("id", id)
    .eq("client_id", userId)
    .maybeSingle();

  if (!svc) notFound();

  let conversationId: string | null = null;
  if (svc.provider_id) {
    const { data } = await supabase.rpc("start_service_chat", { p_request_id: id });
    conversationId = (data as string) ?? null;
  }

  // propostas recebidas (enquanto o cliente ainda não escolheu um profissional)
  let proposals: any[] = [];
  if (!svc.provider_id) {
    const { data: props } = await supabase
      .from("proposals")
      .select(
        "id, price, eta_minutes, advance_pct, provider:profiles!proposals_provider_id_fkey(id, full_name, handle, rating, jobs_done, avatar_path, category:service_categories!profiles_category_id_fkey(name, slug))",
      )
      .eq("request_id", id)
      .order("price", { ascending: true });
    proposals = (props ?? []).map((p: any) => {
      const provider = Array.isArray(p.provider) ? p.provider[0] : p.provider;
      return {
        ...p,
        provider: provider ? { ...provider, category: Array.isArray(provider.category) ? provider.category[0] : provider.category } : null,
      };
    });
  }

  const photoUrls = await signRequestPhotos(supabase, (svc.photos as string[]) ?? []);

  const norm = {
    ...svc,
    photos: photoUrls,
    category: Array.isArray(svc.category) ? svc.category[0] : svc.category,
    provider: Array.isArray(svc.provider) ? svc.provider[0] : svc.provider,
    payment: Array.isArray(svc.payment) ? svc.payment[0] : svc.payment,
  };

  return <ServiceDetail service={norm as any} currentUserId={userId} conversationId={conversationId} proposals={proposals} />;
}
