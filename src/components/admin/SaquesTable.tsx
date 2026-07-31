"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, X, Copy, Clock } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { brl } from "@/lib/pricing";
import { settleWithdrawal } from "@/app/admin/saques/actions";

type Row = {
  id: string;
  amount: number;
  status: string;
  pixKey: string | null;
  note: string | null;
  requestedAt: string;
  paidAt: string | null;
  providerName: string;
  providerCity: string | null;
};

const TONE: Record<string, string> = {
  solicitado: "text-warning bg-warning/10",
  pago: "text-success bg-success/10",
  recusado: "text-danger bg-danger/10",
};

/** Fila de saques dos prestadores: pagar o PIX e registrar aqui. */
export function SaquesTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const pendentes = rows.filter((r) => r.status === "solicitado");
  const totalPendente = pendentes.reduce((s, r) => s + r.amount, 0);
  const pagoTotal = rows.filter((r) => r.status === "pago").reduce((s, r) => s + r.amount, 0);

  async function act(id: string, action: "pago" | "recusado") {
    setBusy(id);
    setError("");
    const res = await settleWithdrawal(id, action);
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "Falha ao processar.");
    router.refresh();
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* sem clipboard */ }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader
        title="Saques"
        subtitle="Pague o PIX na conta do Fixly e registre aqui para fechar o saldo do prestador."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Aguardando pagamento" value={brl(totalPendente)} icon={Clock} accent="warning" />
        <StatCard label="Pedidos na fila" value={pendentes.length} icon={Banknote} accent="primary" />
        <StatCard label="Já pago (histórico)" value={brl(pagoTotal)} icon={Check} accent="success" />
      </div>

      {error && <p className="mt-4 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}

      <div className="mt-6 bg-white rounded-2xl border border-black/5 overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray">Nenhum saque solicitado até agora.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {rows.map((r) => (
              <li key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {r.providerName}
                    {r.providerCity ? <span className="text-gray-light font-normal"> · {r.providerCity}</span> : null}
                  </p>
                  <p className="text-xs text-gray-light">
                    {new Date(r.requestedAt).toLocaleString("pt-BR")}
                    {r.paidAt ? ` · pago em ${new Date(r.paidAt).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                  {r.pixKey ? (
                    <button
                      onClick={() => copyKey(r.pixKey!)}
                      className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-primary-dark hover:underline"
                    >
                      {copied === r.pixKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      PIX: {r.pixKey}
                    </button>
                  ) : (
                    <p className="text-xs text-danger mt-1">Prestador sem chave PIX cadastrada.</p>
                  )}
                </div>

                <span className="text-lg font-bold text-ink shrink-0">{brl(r.amount)}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${TONE[r.status] ?? "text-gray bg-black/5"}`}>
                  {r.status}
                </span>

                {r.status === "solicitado" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, "pago")}>
                      <Check className="h-4 w-4" /> Marcar pago
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "recusado")}>
                      <X className="h-4 w-4" /> Recusar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
