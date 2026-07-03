import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
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
      "id, description, status, urgent, address, lat, lng, estimated_price, final_price, rating, provider_id, created_at, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name, rating, jobs_done, lat, lng), payment:payments(amount, fee, gateway_fee, provider_net, method, status)",
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

  const norm = {
    ...svc,
    category: Array.isArray(svc.category) ? svc.category[0] : svc.category,
    provider: Array.isArray(svc.provider) ? svc.provider[0] : svc.provider,
    payment: Array.isArray(svc.payment) ? svc.payment[0] : svc.payment,
  };

  return <ServiceDetail service={norm as any} currentUserId={userId} conversationId={conversationId} />;
}
