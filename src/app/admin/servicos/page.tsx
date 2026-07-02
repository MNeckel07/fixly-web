import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, estimated_price, urgent, created_at, category:service_categories(name, icon), client:profiles!service_requests_client_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const reqs = (data ?? []) as any[];

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Serviços" subtitle="Pedidos de serviço na plataforma" />
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium">Serviço</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Contratante</th>
              <th className="px-5 py-3 font-medium">Valor est.</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {reqs.map((r) => {
              const cat = Array.isArray(r.category) ? r.category[0] : r.category;
              const client = Array.isArray(r.client) ? r.client[0] : r.client;
              return (
                <tr key={r.id} className="hover:bg-black/[0.015]">
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink">
                      {cat?.icon} {cat?.name ?? "Serviço"}
                    </span>
                    {r.urgent && (
                      <span className="ml-2 text-xs font-semibold text-danger">urgente</span>
                    )}
                    <p className="text-gray-light text-xs truncate max-w-xs">{r.description}</p>
                  </td>
                  <td className="px-5 py-3 text-gray hidden sm:table-cell">{client?.full_name ?? "—"}</td>
                  <td className="px-5 py-3 text-ink font-medium">
                    {r.estimated_price ? `R$ ${r.estimated_price}` : "—"}
                  </td>
                  <td className="px-5 py-3"><Badge status={r.status} /></td>
                </tr>
              );
            })}
            {reqs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-gray">
                  Nenhum serviço solicitado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
