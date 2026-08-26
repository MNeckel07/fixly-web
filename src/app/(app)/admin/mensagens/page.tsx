import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/admin/StatCard";
import { AdminTeamChat } from "@/components/admin/AdminTeamChat";

export const dynamic = "force-dynamic";

export default async function AdminEquipePage() {
  const supabase = await createClient();
  const { userId } = await getProfile();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .neq("id", userId!)
    .order("full_name");

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader title="Equipe" subtitle="Converse com outros administradores." />
      <AdminTeamChat admins={(data as any) ?? []} currentUserId={userId!} />
    </div>
  );
}
