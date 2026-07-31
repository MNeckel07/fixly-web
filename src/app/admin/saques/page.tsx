import { createClient } from "@/lib/supabase/server";
import { SaquesTable } from "@/components/admin/SaquesTable";

export const dynamic = "force-dynamic";

export default async function SaquesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("withdrawals")
    .select("id, amount, status, pix_key, note, requested_at, paid_at, provider:profiles!withdrawals_provider_id_fkey(id, full_name, city)")
    .order("requested_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []).map((w: any) => {
    const p = Array.isArray(w.provider) ? w.provider[0] : w.provider;
    return {
      id: w.id,
      amount: Number(w.amount),
      status: w.status as string,
      pixKey: w.pix_key as string | null,
      note: w.note as string | null,
      requestedAt: w.requested_at as string,
      paidAt: w.paid_at as string | null,
      providerName: p?.full_name ?? "—",
      providerCity: p?.city ?? null,
    };
  });

  return <SaquesTable rows={rows} />;
}
