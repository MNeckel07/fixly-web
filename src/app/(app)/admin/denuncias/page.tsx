import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { ReportsTable } from "@/components/admin/ReportsTable";
import { ReviewDisputesTable, type Contestacao } from "@/components/admin/ReviewDisputesTable";
import { createAdminClient } from "@/lib/supabase/server";

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

  /**
   * CONTESTAÇÕES DE AVALIAÇÃO (0036) — moram aqui e não numa página nova
   * porque são o mesmo trabalho de quem cuida das denúncias: ler os dois lados
   * e decidir. Uma aba a mais no menu seria uma aba quase sempre vazia.
   *
   * Chave de servidor porque o admin precisa ver o pedido dos OUTROS.
   */
  const adminDb = createAdminClient();
  const { data: disp } = await adminDb
    .from("service_requests")
    .select(
      "id, rating, review, created_at, review_dispute, review_disputed_at, review_dispute_status, review_dispute_note, category:service_categories(name), provider:profiles!service_requests_provider_id_fkey(full_name), client:profiles!service_requests_client_id_fkey(full_name)",
    )
    .not("review_disputed_at", "is", null)
    .order("review_disputed_at", { ascending: false })
    .limit(100);

  const contestacoes: Contestacao[] = (disp ?? []).map((d: any) => {
    const cat = Array.isArray(d.category) ? d.category[0] : d.category;
    const prov = Array.isArray(d.provider) ? d.provider[0] : d.provider;
    const cli = Array.isArray(d.client) ? d.client[0] : d.client;
    return {
      id: d.id,
      rating: Number(d.rating ?? 0),
      review: d.review,
      created_at: d.created_at,
      review_dispute: d.review_dispute ?? "",
      review_disputed_at: d.review_disputed_at,
      review_dispute_status: d.review_dispute_status ?? "pendente",
      review_dispute_note: d.review_dispute_note,
      category: cat?.name ?? null,
      providerName: prov?.full_name ?? null,
      clientName: cli?.full_name ?? null,
    };
  });
  const contestacoesAbertas = contestacoes.filter((c) => c.review_dispute_status === "pendente").length;

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

      <div className="mt-10">
        <PageHeader
          title="Contestações de avaliação"
          subtitle={
            contestacoesAbertas > 0
              ? `${contestacoesAbertas} contestação(ões) aguardando decisão. Acolher esconde a avaliação da média e do perfil — nunca reescreve a nota.`
              : "Profissionais podem contestar notas abaixo de 3 estrelas. Acolher esconde a avaliação da média e do perfil — nunca reescreve a nota."
          }
        />
        <ReviewDisputesTable itens={contestacoes} />
      </div>
    </div>
  );
}
