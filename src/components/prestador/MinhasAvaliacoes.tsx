"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ShieldAlert, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { disputeReview } from "@/app/(app)/app/prestador/actions";

export type AvaliacaoRecebida = {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  category: string | null;
  clientName: string | null;
  review_dispute: string | null;
  review_dispute_status: string | null;
  review_dispute_note: string | null;
  review_hidden: boolean;
};

/** Abaixo disto o profissional pode contestar (regra do dono: "menor que 3"). */
const NOTA_CONTESTAVEL = 3;

/**
 * MINHAS AVALIAÇÕES — com o botão de contestar.
 *
 * A tela é deliberadamente honesta nos dois sentidos: mostra a nota como ela é
 * (inclusive a ruim) e deixa claro que contestar não apaga nada sozinho — o
 * suporte apura. Prometer "contestou, sumiu" transformaria o canal em botão de
 * limpar reputação, que é o oposto do que ele existe para ser.
 */
export function MinhasAvaliacoes({ avaliacoes }: { avaliacoes: AvaliacaoRecebida[] }) {
  if (avaliacoes.length === 0) return null;
  return (
    <div className="max-w-lg mx-auto mt-4">
      <div className="rounded-2xl border border-black/5 bg-white p-5">
        <h2 className="font-semibold text-ink">Minhas avaliações</h2>
        <p className="text-sm text-gray-light mt-0.5 mb-4">
          Notas abaixo de {NOTA_CONTESTAVEL} estrelas podem ser contestadas.
        </p>
        <div className="space-y-3">
          {avaliacoes.map((a) => (
            <Item key={a.id} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Item({ a }: { a: AvaliacaoRecebida }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const podeContestar = a.rating < NOTA_CONTESTAVEL && !a.review_dispute_status;

  async function enviar() {
    setBusy(true);
    setErro("");
    try {
      const res = await disputeReview(a.id, texto);
      if (!res.ok) return setErro(res.error ?? "Não foi possível enviar a contestação.");
      setAbrindo(false);
      setTexto("");
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível enviar a contestação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${n <= a.rating ? "fill-primary text-primary" : "text-black/15"}`} />
            ))}
          </div>
          {a.category && <span className="text-xs text-gray-light">· {a.category}</span>}
        </div>
        <span className="text-xs text-gray-light">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
      </div>

      {a.review && <p className="text-sm text-gray mt-2 leading-relaxed">“{a.review}”</p>}
      {a.clientName && <p className="text-[11px] text-gray-light mt-1">— {a.clientName}</p>}

      {/* estado da contestação */}
      {a.review_dispute_status === "pendente" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink">
          <Clock className="h-3.5 w-3.5 shrink-0 text-warning" />
          Contestação enviada — o suporte está apurando.
        </p>
      )}
      {a.review_dispute_status === "acolhida" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Contestação acolhida — esta avaliação não conta na sua média nem aparece no seu perfil.
        </p>
      )}
      {a.review_dispute_status === "negada" && (
        <div className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-gray">
          <p className="inline-flex items-center gap-1.5 text-ink">
            <XCircle className="h-3.5 w-3.5 shrink-0 text-gray-light" /> Contestação analisada e não acolhida.
          </p>
          {a.review_dispute_note && <p className="mt-1">{a.review_dispute_note}</p>}
        </div>
      )}

      {podeContestar && !abrindo && (
        <button
          onClick={() => setAbrindo(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark hover:underline"
        >
          <ShieldAlert className="h-3.5 w-3.5" /> Contestar esta avaliação
        </button>
      )}

      {abrindo && (
        <div className="mt-3">
          <label className="text-xs text-gray-light">
            O que aconteceu? Descreva com fatos — o suporte vai conferir o chat, as fotos e o histórico do serviço.
          </label>
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: o cliente pediu serviço fora do combinado, recusei, e a nota veio por causa disso."
            className="w-full mt-1 rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-primary"
          />
          <p className="text-[11px] text-gray-light mt-1">
            Contestar não apaga a avaliação: se o suporte acolher, ela deixa de contar na média e sai do
            seu perfil público. A nota original fica registrada no histórico.
          </p>
          {erro && <p className="text-xs text-danger mt-1.5">{erro}</p>}
          <div className="flex items-center gap-3 mt-2">
            <Button size="sm" loading={busy} onClick={enviar}>
              Enviar contestação
            </Button>
            <button onClick={() => setAbrindo(false)} disabled={busy} className="text-xs text-gray hover:text-ink">
              cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
