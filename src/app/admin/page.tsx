import Link from "next/link";
import { Clock3, Wrench, Home, ClipboardList, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard, PageHeader } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, type Role } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: pendentes }, { count: prestadores }, { count: contratantes }, { count: servicos }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "prestador").eq("status", "aprovado"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "contratante").eq("status", "aprovado"),
      supabase.from("service_requests").select("*", { count: "exact", head: true }),
    ]);

  const { data: recent } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, city, created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Visão geral" subtitle="Acompanhe os cadastros e a operação da plataforma." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cadastros pendentes" value={pendentes ?? 0} icon={Clock3} accent="warning" />
        <StatCard label="Prestadores ativos" value={prestadores ?? 0} icon={Wrench} accent="primary" />
        <StatCard label="Contratantes ativos" value={contratantes ?? 0} icon={Home} accent="info" />
        <StatCard label="Serviços no total" value={servicos ?? 0} icon={ClipboardList} accent="success" />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 mt-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <h2 className="font-semibold text-ink">Aguardando aprovação</h2>
          <Link href="/admin/cadastros" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-dark">
            Ver fila completa <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-black/5">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-gray">
                    {p.role === "prestador" ? <Wrench className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-ink">{p.full_name}</p>
                    <p className="text-sm text-gray-light">
                      {ROLE_LABELS[p.role as Role]} · {p.city ?? "—"}
                    </p>
                  </div>
                </div>
                <Badge status={p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-gray">Nenhum cadastro pendente. Tudo em dia.</p>
        )}
      </div>
    </div>
  );
}
