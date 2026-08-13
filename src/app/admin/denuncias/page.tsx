import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { ReportsTable } from "@/components/admin/ReportsTable";

export const dynamic = "force-dynamic";

export default async function AdminDenunciasPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select(
      "id, category, description, status, resolution, created_at, handled_at, request_id, reporter:profiles!reports_reporter_id_fkey(id, full_name, role), target:profiles!reports_target_id_fkey(id, full_name, role, rating, jobs_done, seal_active, seal_revoked_at, seal_revoked_reason)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const reports = (data ?? []).map((r: any) => ({
    ...r,
    reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
    target: Array.isArray(r.target) ? r.target[0] : r.target,
  }));

  const abertas = reports.filter((r) => r.status === "aberta").length;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader
        title="Denúncias"
        subtitle={
          abertas > 0
            ? `${abertas} denúncia(s) aguardando análise. O denunciado não sabe que foi denunciado.`
            : "Nenhuma denúncia aberta. O denunciado não sabe que foi denunciado."
        }
      />
      <ReportsTable reports={reports as any} />
    </div>
  );
}
