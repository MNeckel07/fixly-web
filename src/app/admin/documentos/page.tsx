import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { DocTypesManager } from "@/components/admin/DocTypesManager";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_types")
    .select("*")
    .order("applies_to")
    .order("sort");
  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHeader
        title="Tipos de documento"
        subtitle="Defina quais documentos são pedidos no cadastro e se são obrigatórios."
      />
      <DocTypesManager types={(data as any) ?? []} />
    </div>
  );
}
