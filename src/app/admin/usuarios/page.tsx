import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, type Role } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, city, created_at")
    .order("created_at", { ascending: false });

  const users = data ?? [];

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Usuários" subtitle={`${users.length} contas cadastradas`} />
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">E-mail</th>
              <th className="px-5 py-3 font-medium">Perfil</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Cidade</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-black/[0.015]">
                <td className="px-5 py-3 font-medium text-ink">{u.full_name}</td>
                <td className="px-5 py-3 text-gray hidden sm:table-cell">{u.email}</td>
                <td className="px-5 py-3 text-gray">{ROLE_LABELS[u.role as Role]}</td>
                <td className="px-5 py-3 text-gray hidden md:table-cell">{u.city ?? "—"}</td>
                <td className="px-5 py-3"><Badge status={u.status} /></td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray">
                  Nenhum usuário ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
