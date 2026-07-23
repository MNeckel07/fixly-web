"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, MapPin, Check, Wrench, MessageSquare, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { RouteMap } from "@/components/map/RouteMap";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { CategoryIcon } from "@/components/ui/icons";
import { brl, providerNet, ADVANCE_FEE_RATE } from "@/lib/pricing";

type Job = {
  id: string;
  description: string;
  status: "aceito" | "a_caminho" | "em_andamento";
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_price: number | null;
  final_price: number | null;
  mode: string | null;
  urgent: boolean;
  photos: string[] | null;
  category: { name: string; slug: string } | null;
  client: { full_name: string; city: string | null } | null;
};

export function TrabalhoView({
  job,
  currentUserId,
  providerLoc,
  defaultAdvancePct = 0,
}: {
  job: Job | null;
  currentUserId: string;
  providerLoc: { lat: number; lng: number } | null;
  defaultAdvancePct?: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(job?.status ?? "aceito");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [quoteValue, setQuoteValue] = useState("");
  const [advancePct, setAdvancePct] = useState(defaultAdvancePct);
  const [quoteErr, setQuoteErr] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsQuote = job?.mode === "orcamento" && !job?.final_price;
  const awaitingPayment = status === "aceito" && !needsQuote;
  const photos = job?.photos ?? [];

  async function sendQuote() {
    const v = Number(quoteValue);
    if (!v || v <= 0) return setQuoteErr("Informe um valor válido.");
    setQuoteErr("");
    setBusy(true);
    const supabase = createClient();
    await supabase.from("service_requests").update({ final_price: v, advance_pct: advancePct }).eq("id", job!.id);
    setBusy(false);
    router.refresh();
  }

  const dest =
    job?.lat && job?.lng ? { lat: job.lat, lng: job.lng } : { lat: -23.55, lng: -46.63 };
  const origin = providerLoc ?? { lat: dest.lat + 0.025, lng: dest.lng - 0.02 };
  const price = job?.final_price ?? job?.estimated_price ?? 0;

  useEffect(() => {
    if (status !== "a_caminho") return;
    timer.current = setInterval(() => {
      setProgress((v) => {
        if (v >= 1) {
          if (timer.current) clearInterval(timer.current);
          return 1;
        }
        return Math.min(1, v + 0.02);
      });
    }, 160);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [status]);

  if (!job) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/5 p-10 text-center">
        <Wrench className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-ink font-medium">Nenhum trabalho em andamento</p>
        <p className="text-sm text-gray-light mt-1">Aceite um pedido para começar.</p>
        <Link href="/app/prestador" className="inline-flex items-center gap-1 text-primary-dark font-semibold text-sm mt-3">
          Ver pedidos disponíveis <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  async function update(newStatus: string, extra?: () => Promise<void>) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("service_requests").update({ status: newStatus }).eq("id", job!.id);
    if (extra) await extra();
    setBusy(false);
    if (newStatus === "concluido") {
      router.push("/app/prestador/ganhos");
      router.refresh();
    } else {
      setStatus(newStatus as Job["status"]);
    }
  }

  // prefetch da conversa (para o badge de não lidas)
  useEffect(() => {
    if (!job) return;
    const supabase = createClient();
    supabase.rpc("start_service_chat", { p_request_id: job.id }).then(({ data }) => setConvId((data as string) ?? null));
  }, [job]);

  function toggleChat() {
    setShowChat((v) => !v);
  }

  async function conclude() {
    // marca como concluído; a contagem de serviços é atualizada por trigger
    // confiável no banco, e a liberação do pagamento é feita pelo contratante.
    await update("concluido");
  }

  async function decline() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("service_requests").update({ status: "cancelado" }).eq("id", job!.id);
    setBusy(false);
    router.push("/app/prestador");
    router.refresh();
  }

  const arrived = status === "a_caminho" && progress >= 1;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink">
              <CategoryIcon slug={job.category?.slug} className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-ink">{job.category?.name ?? "Serviço"}</p>
              <p className="text-sm text-gray-light">
                {job.client?.full_name} · {job.address || job.client?.city || "—"}
              </p>
            </div>
          </div>
          <div className="text-right">
            {needsQuote ? (
              <p className="text-sm font-semibold text-info">Orçamento</p>
            ) : (
              <>
                <p className="font-bold text-ink">{brl(price)}</p>
                <p className="text-[11px] text-success">recebe {brl(providerNet(price))}</p>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-4">{job.description}</p>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {photos.map((ph) => (
              <a key={ph} href={ph} target="_blank" rel="noreferrer" className="h-16 w-16 rounded-lg overflow-hidden bg-canvas border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph} alt="Foto do serviço" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {["a_caminho", "em_andamento"].includes(status) && (
        <RouteMap
          target={dest}
          targetKind="home"
          origin={origin}
          progress={progress}
          moverKind="wrench"
          requestGps
          showRoute
          height={280}
        />
      )}

      <Button variant="outline" fullWidth onClick={toggleChat}>
        <MessageSquare className="h-4 w-4" /> {showChat ? "Ocultar conversa" : "Conversar com o cliente"}
        {convId && !showChat && <UnreadBadge conversationId={convId} currentUserId={currentUserId} className="ml-1" />}
      </Button>
      {showChat && convId && (
        <ConversationThread conversationId={convId} currentUserId={currentUserId} height={360} />
      )}

      {/* Ações por etapa */}
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        {needsQuote && (
          <div>
            <p className="text-sm text-gray mb-2">
              Combine a visita pelo chat e, depois de avaliar, envie o valor do orçamento. O cliente paga por aqui.
            </p>
            <label className="text-xs text-gray-light">Valor do orçamento</label>
            <div className="flex items-center rounded-xl border border-black/10 px-3 mt-1 mb-2 focus-within:border-primary">
              <span className="text-gray-light text-sm">R$</span>
              <input type="number" value={quoteValue} onChange={(e) => setQuoteValue(e.target.value)} className="w-full py-2.5 px-2 outline-none" placeholder="0,00" />
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-light">Receber adiantado: <b className="text-ink">{advancePct}%</b></label>
                <div className="flex gap-1">
                  {[0, 30, 50, 100].map((p) => (
                    <button key={p} type="button" onClick={() => setAdvancePct(p)} className={`text-[11px] px-2 py-0.5 rounded-full border transition ${advancePct === p ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray"}`}>{p}%</button>
                  ))}
                </div>
              </div>
              <input type="range" min={0} max={100} step={5} value={advancePct} onChange={(e) => setAdvancePct(Number(e.target.value))} className="w-full accent-[#FFC107] mt-1" />
              {advancePct > 0 && Number(quoteValue) > 0 && (
                <p className="text-[11px] text-gray-light">
                  Taxa de adiantamento: <b className="text-ink">- {brl(Math.round((Number(quoteValue) * advancePct / 100) * ADVANCE_FEE_RATE * 100) / 100)}</b> (quanto mais adiantado, menos líquido)
                </p>
              )}
            </div>
            {quoteErr && <p className="text-xs text-danger mb-2">{quoteErr}</p>}
            <Button fullWidth loading={busy} onClick={sendQuote}>Enviar orçamento</Button>
          </div>
        )}
        {awaitingPayment && (
          <div className="text-center text-sm text-gray">
            {job.mode === "orcamento" ? "Orçamento enviado" : "Proposta aceita"} — aguardando o pagamento do cliente para iniciar.
          </div>
        )}
        {status === "aceito" && (
          <button onClick={decline} disabled={busy} className="w-full text-center text-sm text-gray hover:text-danger transition mt-3">
            Recusar este pedido
          </button>
        )}
        {status === "a_caminho" && !arrived && (
          <div className="text-center">
            <p className="text-gray text-sm mb-3">A caminho do cliente...</p>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mb-4">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <Button fullWidth variant="outline" onClick={() => setProgress(1)}>
              Pular animação
            </Button>
          </div>
        )}
        {status === "a_caminho" && arrived && (
          <Button fullWidth size="lg" loading={busy} onClick={() => update("em_andamento")}>
            <MapPin className="h-5 w-5" /> Cheguei — iniciar serviço
          </Button>
        )}
        {status === "em_andamento" && (
          <Button fullWidth size="lg" loading={busy} onClick={conclude}>
            <Check className="h-5 w-5" /> Concluir serviço
          </Button>
        )}
      </div>
    </div>
  );
}
