import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { hasPerm } from "@/lib/permissions";
import { PageHeader } from "@/components/admin/StatCard";
import { CadastrosTable } from "@/components/admin/CadastrosTable";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { userId, profile } = await getProfile();
  if (!hasPerm((profile as any)?.permissions, "usuarios")) redirect("/admin");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, city, active, funcao, permissions, created_at, category:service_categories!profiles_category_id_fkey(name), private:profiles_private(email, phone, username)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((u: any) => {
    const priv = Array.isArray(u.private) ? u.private[0] : u.private;
    return { ...u, priv, email: priv?.email ?? "—", phone: priv?.phone ?? null };
  });

  const users = rows.map((u: any) => ({
    ...u,
    category: (Array.isArray(u.category) ? u.category[0] : u.category)?.name ?? null,
  }));

  const admins = rows
    .filter((u: any) => u.role === "admin")
    .map((u: any) => ({
      id: u.id,
      full_name: u.full_name,
      funcao: u.funcao ?? null,
      permissions: u.permissions ?? null,
      email: u.priv?.email ?? null,
      username: u.priv?.username ?? null,
    }));

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Usuários" subtitle={`${users.length} contas na plataforma`} />
      <StaffManager admins={admins} currentUserId={userId!} />
      <h2 className="font-semibold text-ink mb-3">Todos os cadastros</h2>
      <CadastrosTable users={users} />
    </div>
  );
}
