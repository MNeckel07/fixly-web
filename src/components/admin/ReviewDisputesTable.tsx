"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { resolveReviewDispute } from "@/app/app/report.actions";

export type Contestacao = {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  review_dispute: string;
  review_disputed_at: string;
  review_dispute_status: string;
  review_dispute_note: string | null;
  category: string | null;
  providerName: string | null;
  clientName: string | null;
};

/**
 * Fila de contestações de avaliação.
 *
 * A decisão é binária de propósito — acolher ou negar —, e nenhuma das duas
 * reescreve a nota do cliente. Acolher só faz a avaliação parar de contar
 * (`review_hidden`), e a média do profissional é recalculada na hora.
 */
export function ReviewDisputesTable({ itens }: { itens: Contestacao[] }) {
  if (itens.length === 0) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-10 text-center text-gray">
        Nenhuma contestação de avaliação.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {itens.map((c) => (
        <Linha key={c.id} c={c} />
      ))}
    </div>
  );
}

function Linha({ c }: { c: Contestacao }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const pendente = c.review_dispute_status === "pendente";

  async function decidir(acolhida: boolean) {
    setBusy(true);
    setErro("");
    try {
      const res = await resolveReviewDispute({ requestId: c.id, acolhida, note: nota });
      if (!res.ok) return setErro(res.error ?? "Não foi possível registrar a decisão.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <span className="font-semibold text-ink">{c.providerName ?? "Profissional"}</span>
          <span className="text-xs text-gray-light">contestou a nota de {c.clientName ?? "um cliente"}</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            pendente
              ? "bg-warning/10 text-warning"
              : c.review_dispute_status === "acolhida"
                ? "bg-success/10 text-success"
                : "bg-black/[0.05] text-gray"
          }`}
        >
          {pendente ? "Pendente" : c.review_dispute_status === "acolhida" ? "Acolhida" : "Negada"}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-canvas p-3">
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${n <= c.rating ? "fill-primary text-primary" : "text-black/15"}`} />
            ))}
          </div>
          {c.category && <span className="text-xs text-gray-light">· {c.category}</span>}
          <span className="text-xs text-gray-light">· {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
        </div>
        {c.review && <p className="text-sm text-gray mt-1.5">“{c.review}”</p>}
      </div>

      <p className="mt-3 text-xs font-semibold text-ink">O que o profissional alega</p>
      <p className="text-sm text-gray mt-0.5 leading-relaxed">{c.review_dispute}</p>

      {c.review_dispute_note && !pendente && (
        <p className="mt-2 text-xs text-gray-light">Decisão registrada: {c.review_dispute_note}</p>
      )}

      {pendente && (
        <div className="mt-3">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Justificativa da decisão (o profissional vê este texto)"
            className="w-full h-10 px-3 rounded-xl border border-black/10 text-sm outline-none focus:border-primary"
          />
          {erro && <p className="text-xs text-danger mt-1.5">{erro}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button size="sm" loading={busy} onClick={() => decidir(true)}>
              Acolher (esconde a avaliação)
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decidir(false)}>
              Negar (mantém a nota)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
