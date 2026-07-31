import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos } from "@/lib/uploads";
import { ServiceDetail } from "@/components/contratante/ServiceDetail";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data: svc } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, urgent, address, lat, lng, estimated_price, final_price, mode, rating, review, provider_id, photos, advance_pct, advance_approved, provider_done_at, no_charge, created_at, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name, rating, jobs_done, avatar_path, lat, lng, fix_badge), payment:payments(amount, fee, gateway_fee, provider_net, method, status, advance_pct, advance_amount, advance_fee, available_at)",
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
        "id, price, eta_minutes, advance_pct, counter_price, counter_status, provider:profiles!proposals_provider_id_fkey(id, full_name, handle, rating, jobs_done, avatar_path, category:service_categories!profiles_category_id_fkey(name, slug))",
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

  // SELO FIX: pular o pagamento exige selo nos DOIS lados. Aqui é só para a
  // tela decidir se mostra o botão — quem manda é a checagem em `skipPayment`.
  const { data: me } = await supabase.from("profiles").select("fix_badge").eq("id", userId).single();
  const provider = Array.isArray(svc.provider) ? svc.provider[0] : svc.provider;
  const canSkipPayment =
    !!me?.fix_badge && (!svc.provider_id || !!(provider as { fix_badge?: boolean } | null)?.fix_badge);

  const norm = {
    ...svc,
    photos: photoUrls,
    category: Array.isArray(svc.category) ? svc.category[0] : svc.category,
    provider: Array.isArray(svc.provider) ? svc.provider[0] : svc.provider,
    payment: Array.isArray(svc.payment) ? svc.payment[0] : svc.payment,
  };

  return (
    <>
      {/* propostas, contra-propostas e confirmação de pagamento chegam sozinhas */}
      <AutoRefresh seconds={12} />
      <ServiceDetail service={norm as any} currentUserId={userId} conversationId={conversationId} proposals={proposals} canSkipPayment={canSkipPayment} />
    </>
  );
}
