"use client";

import Link from "next/link";
import { Briefcase, Zap } from "lucide-react";
import { CategoryIcon } from "@/components/ui/icons";
import { brl } from "@/lib/pricing";

type Item = {
  id: string;
  status: string;
  mode: string | null;
  urgent: boolean;
  providerDone: boolean;
  categoryName: string;
  categorySlug: string | null;
  clientName: string;
  price: number | null;
  /**
   * O VALOR JÁ FOI ENVIADO ao cliente (`final_price`), que é diferente de
   * "tem preço": um orçamento pode carregar `estimated_price` (a estimativa
   * da categoria) sem que o profissional tenha mandado nada. Usar `price`
   * para decidir isso faria a lista anunciar "proposta enviada" antes de
   * existir proposta.
   */
  quoted: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  aceito: "aguardando pagamento",
  a_caminho: "a caminho",
  em_andamento: "em andamento",
};

/**
 * O QUE O CLIENTE ESTÁ FAZENDO AGORA (Fixly 13, pág. 2).
 *
 * Pedido do dono: *"no orçamento, ali na parte Cliente - aguardando
 * pagamento, quando a proposta for enviada dá para deixar Cliente - proposta
 * enviada. Daí quando ele aceitar aparece o Cliente - aguardando pagamento"*.
 *
 * Ele está certo, e o rótulo velho era mais que feio — era falso. Num
 * orçamento, `status = 'aceito'` significa só que o pedido é dele; o cliente
 * ainda não viu valor nenhum. Dizer "aguardando pagamento" ali cobra uma
 * decisão que nunca foi apresentada, e o profissional fica esperando um
 * dinheiro que ninguém pediu para pagar.
 *
 * Os três momentos do orçamento, agora com nome próprio:
 *   sem valor enviado  → a bola é DELE  ("aguardando seu orçamento")
 *   valor enviado      → a bola é do CLIENTE ("proposta enviada")
 *   pago               → segue no STATUS_LABEL normal (a caminho, etc.)
 *
 * Fora do orçamento nada muda: ali "aceito" quer dizer que o cliente JÁ
 * escolheu a proposta, então "aguardando pagamento" é literal.
 */
function rotuloDoCliente(j: Item): string {
  if (j.providerDone) return "aguardando aprovação";
  if (j.status === "aceito" && j.mode === "orcamento") {
    return j.quoted ? "proposta enviada" : "aguardando seu orçamento";
  }
  return STATUS_LABEL[j.status] ?? j.status;
}

/** Alterna entre os serviços em aberto do prestador (Express, orçamento, reforma). */
export function JobSwitcher({ jobs, currentId }: { jobs: Item[]; currentId: string | null }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
        <Briefcase className="h-4 w-4" /> Seus serviços em aberto
        <span className="ml-auto text-xs font-normal text-gray-light">{jobs.length}</span>
      </p>
      <div className="space-y-2">
        {jobs.map((j) => {
          const active = j.id === currentId;
          return (
            <Link
              key={j.id}
              href={`/app/prestador/trabalho?job=${j.id}`}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                active ? "border-primary bg-primary/5" : "border-black/10 hover:bg-black/[0.02]"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
                <CategoryIcon slug={j.categorySlug} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-ink">{j.categoryName}</span>
                  {/*
                    A tarja ORÇAMENTO só vale ENQUANTO falta o valor (Fixly 13,
                    pág. 6): *"o que foi em express escrever express, e em vez
                    de orçamento deixar normal, igual deixamos antes de aceitar
                    o serviço"*. Depois de enviado o valor, não há mais
                    orçamento a fazer — é um serviço como outro qualquer, e a
                    tarja só competia com o EXPRESS por atenção.
                    É a MESMA regra que o `PedidosBoard` já usava; esta lista
                    era a única que ainda marcava orçamento para sempre.
                  */}
                  {j.mode === "orcamento" && !j.quoted && (
                    <span className="text-[10px] font-bold text-info bg-info/10 px-1.5 py-0.5 rounded-full">ORÇAMENTO</span>
                  )}
                  {j.urgent && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded-full">
                      <Zap className="h-2.5 w-2.5" /> EXPRESS
                    </span>
                  )}
                  {active && <span className="text-[10px] font-bold text-primary-dark">· ATUAL</span>}
                </span>
                <span className="block text-xs text-gray-light truncate">
                  {j.clientName} · {rotuloDoCliente(j)}
                </span>
              </span>
              {j.price != null && <span className="text-sm font-semibold text-ink shrink-0">{brl(j.price)}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
