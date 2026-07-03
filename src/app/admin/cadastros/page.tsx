import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { ApprovalCard } from "@/components/admin/ApprovalCard";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, cpf, city, role, bio, base_price, service_radius_km, created_at, category:service_categories(name, icon), documents(id, kind, file_path)",
    )
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  const list = (profiles ?? []) as any[];

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHeader
        title="Aprovações de cadastro"
        subtitle="Analise os documentos e aprove ou reprove cada solicitação. O usuário é notificado por e-mail."
      />

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink font-medium">Nenhum cadastro pendente</p>
          <p className="text-gray text-sm mt-1">
            Novas solicitações aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <ApprovalCard
              key={p.id}
              profile={{
                ...p,
                category: Array.isArray(p.category) ? p.category[0] : p.category,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
