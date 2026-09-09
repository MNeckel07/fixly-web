"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/pricing";
import { RequestCard, type Req } from "@/components/prestador/RequestCard";



export function PedidosBoard({
  requests,
  providerId,
  providerName,
  rating,
  jobsDone,
  monthNet,
  monthLabel,
  defaultAdvancePct = 0,
  busy = false,
}: {
  requests: Req[];
  providerId: string;
  providerName: string;
  rating: number;
  jobsDone: number;
  monthNet: number;
  /** Nome do mês corrente — o rótulo dizia só "no mês" e confundia. */
  monthLabel?: string;
  defaultAdvancePct?: number;
  busy?: boolean;
}) {
  const [online, setOnline] = useState(true);
  const router = useRouter();

  /**
   * Pedido novo aparece NA HORA. Sem isto, o prestador só descobria no
   * `AutoRefresh` de 15 s — e o dono cobrou que fosse imediato.
   * O Realtime respeita a RLS: só chega evento de pedido que ele já poderia
   * ler. O AutoRefresh continua no ar como rede de segurança (aba que dormiu,
   * wi-fi que caiu, websocket derrubado).
   */
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("pedidos-abertos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink text-white p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-8 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-white/60 text-sm">Olá, {providerName.split(" ")[0]}</p>
            <p className="text-xl font-bold">
              {busy ? "Você está ocupado" : online ? "Você está online" : "Você está offline"}
            </p>
            {busy && <p className="text-warning text-sm mt-0.5">Em um serviço agora — conclua para receber novos pedidos.</p>}
          </div>
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning bg-warning/15 px-3 py-1.5 rounded-full self-start">
              Ocupado
            </span>
          ) : (
            <button
              onClick={() => setOnline((v) => !v)}
              className={`h-8 w-14 rounded-full p-1 transition ${online ? "bg-success" : "bg-white/20"}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white transition ${online ? "translate-x-6" : ""}`} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 relative">
          <Stat label="Avaliação" value={jobsDone > 0 ? rating.toFixed(1) : "Novo"} />
          <Stat label="Serviços" value={String(jobsDone)} />
          <Stat label={monthLabel ? `Ganhos em ${monthLabel}` : "Ganhos no mês"} value={brl(monthNet)} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Pedidos disponíveis</h2>
          <span className="text-sm text-gray-light">{requests.length} esperando você</span>
        </div>

        {busy ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray">
            Você está <b>ocupado</b> em um serviço. Conclua o atual para pegar novos pedidos.
          </div>
        ) : !online ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray">
            Fique <b>online</b> para receber pedidos.
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
            <Inbox className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-ink font-medium">Nenhum pedido novo no momento</p>
            <p className="text-sm text-gray-light mt-1">
              Pedidos da sua categoria e dentro do seu raio aparecem aqui. Os que você já
              respondeu ficam na aba <b className="text-ink">Trabalho</b>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <RequestCard key={r.id} r={r} defaultAdvancePct={defaultAdvancePct} currentUserId={providerId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-white/50">{label}</p>
    </div>
  );
}
