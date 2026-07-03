"use client";

import { useMemo, useState } from "react";
import { TrendingUp, DollarSign, ClipboardCheck, Receipt } from "lucide-react";
import { StatCard, PageHeader } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { brl, platformFee } from "@/lib/pricing";

type Row = {
  id: string;
  status: string;
  price: number;
  created_at: string;
  urgent: boolean;
  category: string;
  provider: string | null;
};

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

export function VendasDashboard({ rows }: { rows: Row[] }) {
  const [period, setPeriod] = useState("30");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (period !== "all") {
        const days = Number(period);
        if (now - new Date(r.created_at).getTime() > days * 864e5) return false;
      }
      return true;
    });
  }, [rows, period, status]);

  const concluded = filtered.filter((r) => r.status === "concluido");
  const gmv = concluded.reduce((s, r) => s + r.price, 0);
  const receita = concluded.reduce((s, r) => s + platformFee(r.price), 0);
  const ticket = concluded.length ? gmv / concluded.length : 0;

  // GMV por dia
  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    concluded.forEach((r) => {
      const d = new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map[d] = (map[d] ?? 0) + r.price;
    });
    return Object.entries(map).slice(-14);
  }, [concluded]);
  const maxDay = Math.max(1, ...byDay.map(([, v]) => v));

  // por categoria
  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    concluded.forEach((r) => { map[r.category] = (map[r.category] ?? 0) + r.price; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [concluded]);
  const maxCat = Math.max(1, ...byCat.map(([, v]) => v));

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader
        title="Vendas"
        subtitle="Acompanhe o volume de serviços e a receita da plataforma."
        action={
          <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  period === p.key ? "bg-primary text-ink" : "text-gray hover:bg-black/[0.04]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="GMV (volume)" value={brl(gmv)} icon={DollarSign} accent="primary" />
        <StatCard label="Receita (comissão)" value={brl(receita)} icon={TrendingUp} accent="success" />
        <StatCard label="Serviços concluídos" value={concluded.length} icon={ClipboardCheck} accent="info" />
        <StatCard label="Ticket médio" value={brl(ticket)} icon={Receipt} accent="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* GMV por dia */}
        <div className="bg-white rounded-2xl border border-black/5 p-6">
          <h2 className="font-semibold text-ink mb-4">GMV por dia</h2>
          {byDay.length === 0 ? (
            <p className="text-gray text-sm py-8 text-center">Sem dados no período.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {byDay.map(([d, v]) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center h-32">
                    <div className="w-full max-w-7 rounded-t bg-primary/80" style={{ height: `${(v / maxDay) * 100}%`, minHeight: 3 }} title={brl(v)} />
                  </div>
                  <span className="text-[9px] text-gray-light">{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por categoria */}
        <div className="bg-white rounded-2xl border border-black/5 p-6">
          <h2 className="font-semibold text-ink mb-4">Por categoria</h2>
          {byCat.length === 0 ? (
            <p className="text-gray text-sm py-8 text-center">Sem dados no período.</p>
          ) : (
            <div className="space-y-3">
              {byCat.map(([cat, v]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink">{cat}</span>
                    <span className="text-gray font-medium">{brl(v)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(v / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela filtrável */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden mt-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/5">
          <h2 className="font-semibold text-ink">Serviços</h2>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm border border-black/10 rounded-lg px-2 py-1.5 outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="concluido">Concluídos</option>
            <option value="em_andamento">Em andamento</option>
            <option value="buscando">Buscando</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-5 py-2.5 font-medium">Categoria</th>
              <th className="px-5 py-2.5 font-medium hidden sm:table-cell">Prestador</th>
              <th className="px-5 py-2.5 font-medium">Valor</th>
              <th className="px-5 py-2.5 font-medium hidden sm:table-cell">Comissão</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.slice(0, 40).map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5 text-ink">{r.category}{r.urgent && <span className="ml-1.5 text-[10px] text-danger">urgente</span>}</td>
                <td className="px-5 py-2.5 text-gray hidden sm:table-cell">{r.provider ?? "—"}</td>
                <td className="px-5 py-2.5 text-ink font-medium">{brl(r.price)}</td>
                <td className="px-5 py-2.5 text-success hidden sm:table-cell">{brl(platformFee(r.price))}</td>
                <td className="px-5 py-2.5"><Badge status={r.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray">Nenhum serviço no filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
