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
import { cancelJobAsProvider } from "@/app/(app)/app/prestador/actions";
import { ReportButton } from "@/components/ui/ReportButton";

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
  /** Preenchido quando o prestador sinaliza o término (aguarda aprovação). */
  provider_done_at: string | null;
  /** Atendimento de cortesia (Selo Fix): roda igual, mas não gera pagamento. */
  no_charge: boolean | null;
  category: { name: string; slug: string } | null;
  client: { id: string; full_name: string; city: string | null } | null;
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
  const [declineErr, setDeclineErr] = useState("");
  const [doneAt, setDoneAt] = useState<string | null>(job?.provider_done_at ?? null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [quoteValue, setQuoteValue] = useState("");
  const [advancePct, setAdvancePct] = useState(Math.min(defaultAdvancePct, 50));
  const [quoteErr, setQuoteErr] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsQuote = job?.mode === "orcamento" && !job?.final_price;
  const awaitingPayment = status === "aceito" && !needsQuote;
  const photos = job?.photos ?? [];

  /**
   * RASTREIO É COISA DE EXPRESS (Fixly 13, págs. 4 e 5).
   *
   * *"após o pagamento, acho que o mapa e onde está escrito a caminho, dá para
   * deixar apenas para o express."*
   *
   * O mapa e o "a caminho" prometem uma coisa só: **estou indo agora**. Num
   * serviço combinado para o sábado, essa promessa é mentira desde o instante
   * em que o cliente paga — ele vê o boneco no mapa numa terça e fica
   * esperando alguém que nunca disse que ia hoje. Pior: a barra de progresso
   * ali é uma ANIMAÇÃO, não um GPS, então ela "chega" sozinha em 8 segundos.
   *
   * Fora do Express o serviço vai direto de pago para em execução, sem etapa
   * de deslocamento — que é exatamente o que acontece na vida real.
   */
  const express = !!job?.urgent;

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
    // fora do Express não há trajeto para animar — o serviço começa na hora
    if (!express || status !== "a_caminho") return;
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
  }, [status, express]);

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

  /**
   * 🔴 "EU FALEI QUE CHEGUEI, MAS PARA O CLIENTE NÃO APARECEU" (Fixly 13, pág. 7).
   *
   * Esta função tinha DOIS furos que produzem exatamente esse relato:
   *
   *  1. o `error` do update era jogado fora. Se a escrita não passasse (RLS,
   *     guard, rede), `setStatus` mentia de qualquer jeito: a tela DELE
   *     mudava, o banco não. Do outro lado não havia o que aparecer — e nada
   *     na tela dizia que falhou. É a "atualização que casa zero linhas",
   *     silenciosa por natureza no Supabase;
   *  2. não havia `router.refresh()`. O estado passava a viver só na memória
   *     desta aba: bastava um F5 para voltar tudo, e nada revalidava o que o
   *     servidor tinha em cache.
   *
   * Agora o `select()` devolve a linha gravada, e é ela — não o nosso palpite
   * — que vira o estado da tela. Zero linhas de volta significa que a escrita
   * foi recusada, e isso passa a ser um erro visível.
   */
  async function update(newStatus: string, extra?: () => Promise<void>) {
    setBusy(true);
    setDeclineErr("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("service_requests")
      .update({ status: newStatus })
      .eq("id", job!.id)
      .select("status");
    if (error || !data || data.length === 0) {
      setBusy(false);
      return setDeclineErr(
        error?.message ?? "Não foi possível atualizar o serviço. Recarregue a página e tente de novo.",
      );
    }
    if (extra) await extra();
    setBusy(false);
    setStatus(data[0].status as Job["status"]);
    // sem isto o cliente só via a mudança no AutoRefresh dele, e o cache do
    // servidor continuava servindo o status velho para esta aba
    router.refresh();
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

  /**
   * Sinaliza que o serviço terminou. NÃO conclui o pedido: o status só vira
   * 'concluido' quando o CONTRATANTE aprova — é a aprovação que libera o
   * pagamento e faz o valor entrar em Ganhos. (Antes o dinheiro caía aqui.)
   */
  async function conclude() {
    setBusy(true);
    const supabase = createClient();
    // `select()` pelo mesmo motivo do `update()` acima: sem a linha de volta,
    // uma escrita recusada pela RLS passaria como sucesso e o cliente nunca
    // saberia que o serviço acabou ("nem que o serviço tinha sido concluído")
    const { data, error } = await supabase
      .from("service_requests")
      .update({ provider_done_at: new Date().toISOString() })
      .eq("id", job!.id)
      .select("provider_done_at");
    setBusy(false);
    if (error) return setQuoteErr(error.message);
    if (!data || data.length === 0) {
      return setQuoteErr("Não foi possível concluir o serviço. Recarregue a página e tente de novo.");
    }
    setDoneAt(data[0].provider_done_at as string);
    router.refresh();
  }

  /**
   * Desistir do serviço. Passa pela server action porque o desfecho depende do
   * pagamento: sem pagamento o pedido volta para a fila; com pagamento retido, o
   * contratante é estornado ANTES de qualquer coisa ser marcada no banco.
   * (Antes daqui isto era um update direto para 'cancelado' — cancelava o pedido
   * do cliente e deixava o dinheiro preso.)
   */
  async function decline() {
    setBusy(true);
    setDeclineErr("");
    const res = await cancelJobAsProvider(job!.id);
    setBusy(false);
    if (!res.ok) return setDeclineErr(res.error ?? "Não foi possível cancelar.");
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
                {job.no_charge ? (
                  <p className="text-[11px] text-gray-light">Cortesia · sem cobrança</p>
                ) : (
                  <p className="text-[11px] text-success">recebe {brl(providerNet(price))}</p>
                )}
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-4">{job.description}</p>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {photos.map((ph) => (
              <a key={ph} href={ph} rel="noreferrer" className="h-16 w-16 rounded-lg overflow-hidden bg-canvas border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph} alt="Foto do serviço" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {express && ["a_caminho", "em_andamento"].includes(status) && (
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
                <label className="text-xs text-gray-light">Receber adiantado: <b className="text-ink">{advancePct}%</b> <span className="text-gray-light">(máx 50%)</span></label>
                <div className="flex gap-1">
                  {[0, 25, 50].map((p) => (
                    <button key={p} type="button" onClick={() => setAdvancePct(p)} className={`text-[11px] px-2 py-0.5 rounded-full border transition ${advancePct === p ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray"}`}>{p}%</button>
                  ))}
                </div>
              </div>
              <input type="range" min={0} max={50} step={5} value={advancePct} onChange={(e) => setAdvancePct(Number(e.target.value))} className="w-full accent-[#FFC107] mt-1" />
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
        {/*
          A AÇÃO PRINCIPAL VEM PRIMEIRO (Fixly 13, pág. 5: *"nesta parte acho
          que dá para deixar mais espaçado e mais bonito"*).

          Na versão anterior o "Cancelar este trabalho" ficava ACIMA do botão
          de concluir e colado nele — o texto de saída disputava espaço com a
          ação que o profissional realmente veio fazer, e os dois se tocavam.
          Agora: ação principal em cima, respiro, e a saída embaixo, separada
          por uma linha, no tom de perigo que o dono pediu.
        */}
        {express && status === "a_caminho" && !arrived && (
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
        {status === "a_caminho" && (!express || arrived) && (
          <Button fullWidth size="lg" loading={busy} onClick={() => update("em_andamento")}>
            <MapPin className="h-5 w-5" /> {express ? "Cheguei — iniciar serviço" : "Iniciar serviço"}
          </Button>
        )}
        {status === "em_andamento" && !doneAt && (
          <>
            <Button fullWidth size="lg" loading={busy} onClick={conclude}>
              <Check className="h-5 w-5" /> Concluir serviço
            </Button>
            <p className="text-xs text-gray-light text-center mt-2.5 leading-relaxed">
              Ao concluir, o cliente é avisado para aprovar. O pagamento entra nos seus
              Ganhos assim que ele aprovar.
            </p>
          </>
        )}

        {/* Desistir vale enquanto o serviço não terminou — não só no "aceito".
            Era a reclamação: depois de aceitar, não havia como sair. */}
        {["aceito", "a_caminho", "em_andamento"].includes(status) && !doneAt && (
          <div className="mt-6 pt-5 border-t border-black/5">
            <button
              onClick={decline}
              disabled={busy}
              className="w-full h-11 rounded-xl border border-danger/25 text-sm font-semibold text-danger hover:bg-danger/5 transition disabled:opacity-50"
            >
              {status === "aceito" ? "Recusar este pedido" : "Cancelar este trabalho"}
            </button>
            <p className="text-[11px] text-gray-light text-center mt-2 leading-relaxed">
              Sem pagamento, o pedido volta para a fila. Já pago, o cliente é estornado.
            </p>
            {declineErr && <p className="text-xs text-danger text-center mt-2">{declineErr}</p>}
            {job.client && (
              <div className="flex justify-center mt-4">
                <ReportButton
                  targetId={job.client.id}
                  targetName={job.client.full_name}
                  requestId={job.id}
                  label="Denunciar este cliente"
                />
              </div>
            )}
          </div>
        )}
        {doneAt && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-success/5 text-success px-4 py-3 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              <span>Serviço concluído — aguardando a aprovação do cliente.</span>
            </div>
            <p className="text-xs text-gray-light mt-2">
              {job.no_charge
                ? "Atendimento de cortesia: este serviço não gera crédito na sua carteira."
                : `Assim que ele aprovar, o valor de ${brl(providerNet(price))} entra na sua carteira.`}
            </p>
            <Link href="/app/prestador/ganhos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-dark mt-3">
              Ver meus ganhos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
