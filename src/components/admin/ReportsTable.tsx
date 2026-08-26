"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, ShieldOff, ShieldCheck, Check, Archive, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { handleReport } from "@/app/app/report.actions";
import { setSealRevocation } from "@/app/admin/actions";
import { MOTIVOS } from "@/lib/reports";

type Report = {
  id: string;
  category: string;
  description: string;
  status: "aberta" | "em_analise" | "resolvida" | "arquivada";
  resolution: string | null;
  created_at: string;
  handled_at: string | null;
  request_id: string | null;
  reporter: { id: string; full_name: string; role: string } | null;
  target: {
    id: string;
    full_name: string;
    role: string;
    rating: number | null;
    jobs_done: number | null;
    seal_active: boolean | null;
    seal_revoked_at: string | null;
    seal_revoked_reason: string | null;
  } | null;
};

const MOTIVO_LABEL = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.label]));

const STATUS: Record<Report["status"], { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-danger/10 text-danger" },
  em_analise: { label: "Em análise", cls: "bg-warning/15 text-warning" },
  resolvida: { label: "Resolvida", cls: "bg-success/10 text-success" },
  arquivada: { label: "Arquivada", cls: "bg-black/[0.06] text-gray" },
};

/**
 * Fila de denúncias.
 *
 * A ação forte fica aqui do lado: revogar o Selo do denunciado (com motivo, que
 * vai no e-mail para ele). É o desfecho previsto nos Termos para fraude,
 * manipulação de avaliação, dano grave, assédio e cobrança por fora.
 */
export function ReportsTable({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todas" | Report["status"]>("aberta");
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [resolucao, setResolucao] = useState<Record<string, string>>({});

  const lista = reports.filter((r) => {
    if (filtro !== "todas" && r.status !== filtro) return false;
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (
      r.target?.full_name.toLowerCase().includes(t) ||
      r.reporter?.full_name.toLowerCase().includes(t) ||
      r.description.toLowerCase().includes(t)
    );
  });

  async function tratar(r: Report, status: "em_analise" | "resolvida" | "arquivada") {
    setBusy(r.id);
    setErro("");
    const res = await handleReport({ id: r.id, status, resolution: resolucao[r.id] });
    setBusy(null);
    if (!res.ok) return setErro(res.error ?? "Falhou.");
    router.refresh();
  }

  async function selo(r: Report, revogar: boolean) {
    if (!r.target) return;
    const motivo = revogar
      ? (resolucao[r.id]?.trim() || MOTIVO_LABEL[r.category] || "Conduta em desacordo com os Termos")
      : undefined;
    setBusy(r.id);
    setErro("");
    const res = await setSealRevocation(r.target.id, revogar, motivo);
    setBusy(null);
    if (!res.ok) return setErro(res.error ?? "Falhou.");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["aberta", "em_analise", "resolvida", "arquivada", "todas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`h-9 px-3.5 rounded-xl text-sm font-medium transition ${
              filtro === f ? "bg-ink text-white" : "bg-white text-gray border border-black/10 hover:bg-black/[0.03]"
            }`}
          >
            {f === "todas" ? "Todas" : STATUS[f].label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-light" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou texto"
            className="h-9 w-64 pl-9 pr-3 rounded-xl border border-black/10 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {erro && <p className="mb-3 text-sm text-danger">{erro}</p>}

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray">
          Nenhuma denúncia nesta lista.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-black/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Flag className="h-4 w-4 shrink-0 text-danger" />
                    <p className="font-semibold text-ink">{MOTIVO_LABEL[r.category] ?? r.category}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS[r.status].cls}`}>
                      {STATUS[r.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray mt-1.5 whitespace-pre-wrap">{r.description}</p>
                  <p className="text-xs text-gray-light mt-2">
                    <b className="text-ink">{r.reporter?.full_name ?? "—"}</b> ({r.reporter?.role}) denunciou{" "}
                    <b className="text-ink">{r.target?.full_name ?? "—"}</b> ({r.target?.role}) ·{" "}
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                    {r.request_id && <> · serviço <code className="text-[10px]">{r.request_id.slice(0, 8)}</code></>}
                  </p>
                  {r.target?.role === "prestador" && (
                    <p className="text-xs text-gray-light mt-1">
                      Denunciado: {r.target.jobs_done ?? 0} serviços · nota{" "}
                      {r.target.rating != null ? r.target.rating.toFixed(1) : "—"} ·{" "}
                      {r.target.seal_revoked_at
                        ? `Selo REVOGADO (${r.target.seal_revoked_reason ?? "sem motivo"})`
                        : r.target.seal_active
                          ? "com Selo Fixly"
                          : "sem selo"}
                    </p>
                  )}
                  {r.resolution && (
                    <p className="text-xs text-success mt-1.5">Desfecho: {r.resolution}</p>
                  )}
                </div>
              </div>

              {r.status !== "resolvida" && r.status !== "arquivada" && (
                <div className="mt-4 border-t border-black/5 pt-4">
                  <input
                    value={resolucao[r.id] ?? ""}
                    onChange={(e) => setResolucao((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="O que foi apurado / motivo da revogação (vai no e-mail do profissional)"
                    className="w-full h-10 px-3 rounded-xl border border-black/10 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button size="sm" variant="outline" loading={busy === r.id} onClick={() => tratar(r, "em_analise")}>
                      Em análise
                    </Button>
                    {r.target?.role === "prestador" && (
                      r.target.seal_revoked_at ? (
                        <Button size="sm" variant="outline" loading={busy === r.id} onClick={() => selo(r, false)}>
                          <ShieldCheck className="h-4 w-4" /> Devolver o Selo
                        </Button>
                      ) : (
                        <Button size="sm" variant="danger" loading={busy === r.id} onClick={() => selo(r, true)}>
                          <ShieldOff className="h-4 w-4" /> Revogar o Selo
                        </Button>
                      )
                    )}
                    <Button size="sm" loading={busy === r.id} onClick={() => tratar(r, "resolvida")}>
                      <Check className="h-4 w-4" /> Resolvida
                    </Button>
                    <button
                      onClick={() => tratar(r, "arquivada")}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-1.5 text-sm text-gray hover:text-ink disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" /> Arquivar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
