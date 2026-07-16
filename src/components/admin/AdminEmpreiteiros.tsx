"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { setEmpreiteiroSubscription } from "@/app/admin/empreiteiros/actions";

type Emp = {
  id: string;
  company_name: string;
  city: string | null;
  phone: string | null;
  subscription_active: boolean;
  subscription_until: string | null;
  category: { name: string } | null;
  owner: { full_name: string } | null;
};

export function AdminEmpreiteiros({ empreiteiros }: { empreiteiros: Emp[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(e: Emp) {
    setBusy(e.id);
    await setEmpreiteiroSubscription(e.id, !e.subscription_active);
    setBusy(null);
  }

  if (empreiteiros.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
        <Building2 className="h-10 w-10 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-ink font-medium">Nenhum empreiteiro cadastrado</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-canvas text-gray-light">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Responsável</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Cidade</th>
            <th className="px-4 py-3 font-medium">Assinatura</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {empreiteiros.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 font-medium text-ink">{e.company_name}</td>
              <td className="px-4 py-3 text-gray">{e.owner?.full_name ?? "—"}</td>
              <td className="px-4 py-3 text-gray">{e.category?.name ?? "—"}</td>
              <td className="px-4 py-3 text-gray">{e.city ?? "—"}</td>
              <td className="px-4 py-3">
                {e.subscription_active ? (
                  <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                    Ativa{e.subscription_until ? ` · ${new Date(e.subscription_until).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-gray bg-black/[0.05] px-2.5 py-1 rounded-full">Inativa</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => toggle(e)}
                  disabled={busy === e.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    e.subscription_active ? "border-danger/30 text-danger hover:bg-danger/5" : "border-ink bg-ink text-white hover:bg-ink-soft"
                  }`}
                >
                  {busy === e.id ? "..." : e.subscription_active ? "Desativar" : "Ativar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
