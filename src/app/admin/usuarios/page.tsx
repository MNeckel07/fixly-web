import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { CadastrosTable } from "@/components/admin/CadastrosTable";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, status, city, active, created_at, category:service_categories(name)")
    .order("created_at", { ascending: false });

  const users = (data ?? []).map((u: any) => ({
    ...u,
    category: (Array.isArray(u.category) ? u.category[0] : u.category)?.name ?? null,
  }));

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Cadastros" subtitle={`${users.length} contas na plataforma`} />
      <CadastrosTable users={users} />
    </div>
  );
}
