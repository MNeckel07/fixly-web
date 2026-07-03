"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ROLE_LABELS, type Role } from "@/lib/brand";
import { setUserActive, deleteUser } from "@/app/admin/usuarios/actions";

type U = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: string;
  city: string | null;
  active: boolean;
  category: string | null;
  created_at: string;
};

export function CadastrosTable({ users }: { users: U[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [confirm, setConfirm] = useState<{ kind: "delete" | "inactivate" | "activate"; user: U } | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (role !== "all" && u.role !== role) return false;
        if (status === "inativo" ? u.active : status !== "all" && u.status !== status) return false;
        if (q && !`${u.full_name} ${u.email} ${u.city ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [users, role, status, q],
  );

  const counts = useMemo(
    () => ({
      total: users.length,
      prestadores: users.filter((u) => u.role === "prestador").length,
      contratantes: users.filter((u) => u.role === "contratante").length,
      inativos: users.filter((u) => !u.active).length,
    }),
    [users],
  );

  async function message(u: U) {
    const supabase = createClient();
    const { data } = await supabase.rpc("start_approval_chat", { p_applicant: u.id });
    if (data) router.push(`/admin/mensagens?c=${data}`);
  }

  function doConfirm() {
    if (!confirm) return;
    const fd = new FormData();
    fd.set("id", confirm.user.id);
    if (confirm.kind === "delete") {
      startTransition(async () => { await deleteUser(fd); setConfirm(null); });
    } else {
      fd.set("active", String(confirm.user.active));
      startTransition(async () => { await setUserActive(fd); setConfirm(null); });
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", v: counts.total },
          { label: "Prestadores", v: counts.prestadores },
          { label: "Contratantes", v: counts.contratantes },
          { label: "Inativos", v: counts.inativos },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-black/5 px-4 py-3">
            <p className="text-2xl font-bold text-ink">{c.v}</p>
            <p className="text-xs text-gray-light">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cidade..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-black/10 outline-none focus:border-primary text-sm"
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 px-3 rounded-lg border border-black/10 text-sm outline-none">
          <option value="all">Todos os perfis</option>
          <option value="prestador">Prestadores</option>
          <option value="contratante">Contratantes</option>
          <option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-black/10 text-sm outline-none">
          <option value="all">Todos os status</option>
          <option value="aprovado">Aprovados</option>
          <option value="pendente">Pendentes</option>
          <option value="reprovado">Reprovados</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Perfil</th>
              <th className="px-5 py-3 font-medium">Contato</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.map((u) => (
              <tr key={u.id} className={u.active ? "" : "bg-black/[0.015]"}>
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{u.full_name}</p>
                  <p className="text-xs text-gray-light">{u.city ?? "—"}</p>
                </td>
                <td className="px-5 py-3 text-gray">
                  {ROLE_LABELS[u.role]}
                  {u.category && <span className="block text-xs text-gray-light">{u.category}</span>}
                </td>
                <td className="px-5 py-3 text-gray">
                  <p>{u.email}</p>
                  <p className="text-xs text-gray-light">{u.phone ?? "—"}</p>
                </td>
                <td className="px-5 py-3">
                  {u.active ? <Badge status={u.status} /> : <span className="text-xs font-semibold text-gray bg-black/[0.06] px-2.5 py-1 rounded-full">Inativo</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => message(u)} title="Enviar mensagem" className="p-2 text-gray hover:text-info rounded-lg hover:bg-black/[0.04]">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirm({ kind: u.active ? "inactivate" : "activate", user: u })}
                      title={u.active ? "Inativar" : "Reativar"}
                      className="p-2 text-gray hover:text-warning rounded-lg hover:bg-black/[0.04]"
                    >
                      {u.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setConfirm({ kind: "delete", user: u })} title="Excluir" className="p-2 text-gray hover:text-danger rounded-lg hover:bg-black/[0.04]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray">Nenhum cadastro no filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === "delete"
            ? "Excluir cadastro?"
            : confirm?.kind === "inactivate"
            ? "Inativar cadastro?"
            : "Reativar cadastro?"
        }
        description={
          confirm?.kind === "delete"
            ? `A conta de ${confirm?.user.full_name} será removida permanentemente (login e dados). Esta ação não pode ser desfeita.`
            : confirm?.kind === "inactivate"
            ? `${confirm?.user.full_name} não poderá mais operar na plataforma até ser reativado.`
            : `${confirm?.user.full_name} volta a operar normalmente.`
        }
        confirmLabel={confirm?.kind === "delete" ? "Excluir" : confirm?.kind === "inactivate" ? "Inativar" : "Reativar"}
        variant={confirm?.kind === "activate" ? "primary" : "danger"}
        loading={pending}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
