import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/admin/StatCard";
import { AdminTickets } from "@/components/admin/AdminTickets";

export const dynamic = "force-dynamic";

export default async function AdminSuportePage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  const { data } = await supabase
    .from("tickets")
    .select(
      "id, category, priority, subject, description, status, created_at, conversation_id, opener:profiles!tickets_opener_id_fkey(full_name, role)",
    )
    .order("created_at", { ascending: false });

  const tickets = (data ?? []).map((t: any) => ({
    ...t,
    opener: Array.isArray(t.opener) ? t.opener[0] : t.opener,
  }));

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader title="Suporte" subtitle="Chamados abertos por prestadores e contratantes." />
      <AdminTickets tickets={tickets} currentUserId={userId!} />
    </div>
  );
}
