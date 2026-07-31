import { createClient } from "@/lib/supabase/server";
import { VendasDashboard } from "@/components/admin/VendasDashboard";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const supabase = await createClient();
  // Traz o PAGAMENTO junto: GMV e receita saem do que realmente foi cobrado
  // (`payments.amount` / `fee`), não de uma reestimativa em cima do preço do
  // pedido. Sem pagamento, cai no preço do pedido como aproximação.
  const { data } = await supabase
    .from("service_requests")
    .select(
      "id, status, estimated_price, final_price, created_at, urgent, category:service_categories(name, slug), provider:profiles!service_requests_provider_id_fkey(full_name), payment:payments(amount, fee, gateway_fee, provider_net, status, method)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map((r: any) => {
    const pay = Array.isArray(r.payment) ? r.payment[0] : r.payment;
    const fallback = Number(r.final_price ?? r.estimated_price ?? 0);
    return {
      id: r.id,
      status: r.status,
      price: Number(pay?.amount ?? fallback),
      fee: pay ? Number(pay.fee ?? 0) : null,
      gatewayFee: pay ? Number(pay.gateway_fee ?? 0) : null,
      providerNet: pay ? Number(pay.provider_net ?? 0) : null,
      paid: !!pay && pay.status !== "reembolsado",
      payStatus: (pay?.status as string) ?? null,
      method: (pay?.method as string) ?? null,
      created_at: r.created_at,
      urgent: r.urgent,
      category: (Array.isArray(r.category) ? r.category[0] : r.category)?.name ?? "—",
      provider: (Array.isArray(r.provider) ? r.provider[0] : r.provider)?.full_name ?? null,
    };
  });

  return <VendasDashboard rows={rows} />;
}
