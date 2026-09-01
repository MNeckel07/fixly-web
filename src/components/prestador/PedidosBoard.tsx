"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, User, MapPin, Check, ArrowRight, X, Lock, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { AreaMap } from "@/components/map/AreaMap";
import { ServiceChatBox } from "@/components/chat/ServiceChatBox";
import { brl, providerNet, ADVANCE_FEE_RATE } from "@/lib/pricing";
import { MAX_RODADAS_NEGOCIACAO as MAX_RODADAS } from "@/lib/negotiation";
import { cancelJobAsProvider } from "@/app/(app)/app/prestador/actions";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { notifyCounter, notifyProposal } from "@/app/(app)/app/notify.actions";

/** Job já atribuído a este prestador (orçamento/reforma ou Express aceito). */
type MyJob = {
  id: string;
  description: string;
  status: string;
  address: string | null;
  mode: string | null;
  urgent?: boolean;
  /** Conversa do serviço — para mostrar de qual deles é a mensagem nova. */
  conversationId?: string | null;
  final_price: number | null;
  category: { name: string; slug: string } | null;
  client: { full_name: string; city: string | null } | null;
};

type Req = {
  id: string;
  description: string;
  urgent: boolean;
  /** Região aproximada (bairro/cidade). O endereço exato só depois do aceite. */
  area: string | null;
  estimated_price: number | null;
  estimated_min: number | null;
  estimated_max: number | null;
  /** Centro DESLOCADO — serve para desenhar a área, não para achar a casa. */
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  /** Pedido que o contratante mandou direto para este profissional. */
  direct: boolean;
  photos: string[] | null;
  category: { name: string; slug: string } | null;
  client: { full_name: string; city: string | null } | null;
  myProposal: {
    id: string;
    price: number;
    eta: number | null;
    advance_pct: number;
    /**
     * Taxa de DESLOCAMENTO, cobrada à parte do serviço.
     *
     * ⚠️ O nome na tela era "Frete (deslocamento)" até a 0037. Virou só
     * "Deslocamento" porque "Frete e carreto" passou a ser uma CATEGORIA de
     * serviço (levar um móvel para outra casa): a mesma palavra significaria
     * duas coisas na mesma tela. A coluna do banco segue `travel_fee`.
     */
    travel_fee: number;
    counter_price: number | null;
    counter_status: string | null;
    counter_by: string | null;
    /** Quantas idas e voltas de VALOR já foram gastas (limite na 0036). */
    counter_rounds: number;
  } | null;
};

export function PedidosBoard({
  requests,
  myJobs = [],
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
  myJobs?: MyJob[];
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
  const available = online && !busy;
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

      {/* Serviços já seus que ainda esperam o pagamento do cliente. Depois que
          o dinheiro entra, o serviço passa a viver só na aba Trabalho (Fixly 12). */}
      {myJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Seus serviços e orçamentos</h2>
            <span className="text-sm text-gray-light">
              {myJobs.length} aguardando pagamento
            </span>
          </div>
          <div className="space-y-3">
            {myJobs.map((j) => (
              <div key={j.id} className="bg-white rounded-2xl border border-black/5 hover:border-primary/40 transition">
              <Link
                href="/app/prestador/trabalho"
                className="block p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
                      <CategoryIcon slug={j.category?.slug} className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">{j.category?.name ?? "Serviço"}</p>
                        {/* Depois de aceito o serviço não é mais "orçamento":
                            o valor já foi combinado. A tarja só confunde. */}
                        {j.mode === "orcamento" && !j.final_price && (
                          <span className="text-[11px] font-bold text-info bg-info/10 px-2 py-0.5 rounded-full">ORÇAMENTO</span>
                        )}
                        {j.urgent && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                            <Zap className="h-3 w-3" /> EXPRESS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray mt-0.5">{j.description}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-light mt-1">
                        <User className="h-3.5 w-3.5" /> {j.client?.full_name ?? "Cliente"}
                        <MapPin className="h-3.5 w-3.5 ml-1" /> {j.address || j.client?.city || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5">
                      {j.conversationId && (
                        <UnreadBadge conversationId={j.conversationId} currentUserId={providerId} />
                      )}
                      <Badge status={j.status} />
                    </span>
                    {j.final_price ? (
                      <p className="text-sm font-semibold text-ink mt-1">{brl(j.final_price)}</p>
                    ) : (
                      <p className="text-[11px] text-info mt-1">enviar valor</p>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-dark mt-3">
                  Abrir na aba Trabalho <ArrowRight className="h-4 w-4" />
                </span>
                </Link>
                <CancelarTrabalho requestId={j.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Pedidos disponíveis</h2>
          <span className="text-sm text-gray-light">{requests.length} na sua região</span>
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
            <p className="text-ink font-medium">Nenhum pedido no momento</p>
            <p className="text-sm text-gray-light mt-1">
              Pedidos da sua categoria e dentro do seu raio aparecem aqui.
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

function RequestCard({
  r,
  defaultAdvancePct,
  currentUserId,
}: {
  r: Req;
  defaultAdvancePct: number;
  currentUserId: string;
}) {
  const router = useRouter();
  // sem preço-base: o prestador digita o valor de cada serviço
  const [value, setValue] = useState<string>(r.myProposal ? String(r.myProposal.price) : "");
  /**
   * FRETE / taxa de deslocamento — pedido do dono ("adicionar frete nas opções
   * de serviço"). Fica FORA do preço do serviço porque a política de
   * cancelamento manda reter "o valor da taxa de deslocamento" em duas
   * situações (itens 3.3 e 5.1): somado ao preço, não haveria como saber
   * quanto era na hora que a regra vale dinheiro.
   */
  const [frete, setFrete] = useState<string>(r.myProposal ? String(r.myProposal.travel_fee || "") : "");
  const [advancePct, setAdvancePct] = useState<number>(Math.min(defaultAdvancePct, 50));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(!!r.myProposal);
  const [error, setError] = useState("");
  const [counterStatus, setCounterStatus] = useState<string | null>(r.myProposal?.counter_status ?? null);
  const [counterBy, setCounterBy] = useState<string | null>(r.myProposal?.counter_by ?? null);
  const [counterPrice, setCounterPrice] = useState<number | null>(r.myProposal?.counter_price ?? null);
  const [rodadas, setRodadas] = useState<number>(r.myProposal?.counter_rounds ?? 0);
  const [myCounter, setMyCounter] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  const photos = r.photos ?? [];

  /** A bola está comigo: o contratante mandou um valor e eu ainda não respondi. */
  const waitingMe = counterStatus === "pendente" && counterBy !== currentUserId;
  const waitingThem = counterStatus === "pendente" && counterBy === currentUserId;

  async function respondCounter(accept: boolean) {
    if (!r.myProposal) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("respond_counter", {
      p_proposal_id: r.myProposal.id,
      p_accept: accept,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setCounterStatus(accept ? "aceita" : "recusada");
    if (accept && counterPrice != null) setValue(String(counterPrice));
    router.refresh();
  }

  /**
   * Contra-proposta DO PRESTADOR.
   *
   * A ida e volta NÃO é mais infinita ("as propostas tão infinitas"): a 0036
   * limita a 4 valores — contratante, prestador, contratante, prestador — e o
   * último é sempre o do profissional. Depois disso o contratante só aceita ou
   * recusa. O banco recusa de qualquer jeito; aqui a tela apenas para de
   * oferecer o botão, para o limite não virar erro na cara de quem clicou.
   */
  async function sendMyCounter() {
    if (!r.myProposal) return;
    const v = Number(myCounter);
    if (!v || v <= 0) return setError("Informe um valor válido.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("counter_proposal", {
      p_proposal_id: r.myProposal.id,
      p_price: v,
    });
    setBusy(false);
    if (error) return setError(error.message);
    await notifyCounter(r.myProposal.id);
    setCounterPrice(v);
    setCounterStatus("pendente");
    setCounterBy(currentUserId);
    setRodadas((n) => n + 1);
    setShowCounter(false);
    setMyCounter("");
    router.refresh();
  }

  const price = Number(value) || 0;
  const freteNum = Math.max(Number(frete) || 0, 0);
  const advanceFee = Math.round(((price * advancePct) / 100) * ADVANCE_FEE_RATE * 100) / 100;
  /**
   * O frete entra INTEIRO no líquido: a comissão de 15% incide só sobre o
   * serviço (decisão do dono, 26/08/2026) — a Fixly não ganha sobre o custo de
   * o profissional chegar até lá. Por isso `providerNet(serviço, frete)` e não
   * `providerNet(serviço + frete)`, que cobraria comissão do deslocamento.
   */
  const net = Math.max(providerNet(price, freteNum) - advanceFee, 0);

  /** A negociação acabou: o último valor foi o dele. */
  const negociacaoNoLimite = rodadas >= MAX_RODADAS;

  async function submit() {
    if (!price || price <= 0) return setError("Informe um valor válido.");
    if (freteNum < 0) return setError("O frete não pode ser negativo.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_proposal", {
      p_request_id: r.id,
      p_price: price,
      p_eta: null,
      p_message: null,
      p_advance_pct: advancePct,
      p_travel_fee: freteNum,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
    // mexer no preço zera a negociação (o banco faz o mesmo no submit_proposal)
    setCounterStatus(null);
    setCounterBy(null);
    setCounterPrice(null);
    setRodadas(0);
    await notifyProposal(r.id);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink">
            <CategoryIcon slug={r.category?.slug} className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-ink">{r.category?.name ?? "Serviço"}</p>
              {r.urgent && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                  <Zap className="h-3 w-3" /> EXPRESS
                </span>
              )}
              {r.direct && (
                <span className="text-[11px] font-bold text-info bg-info/10 px-2 py-0.5 rounded-full">DIRETO PARA VOCÊ</span>
              )}
            </div>
            <p className="text-sm text-gray mt-0.5">{r.description}</p>
            <p className="flex items-center gap-1 text-xs text-gray-light mt-1">
              <User className="h-3.5 w-3.5" /> {r.client?.full_name ?? "Cliente"}
              <MapPin className="h-3.5 w-3.5 ml-1" /> {r.area || "região não informada"}
              {r.distanceKm != null && <span>· ~{r.distanceKm.toFixed(1)} km de você</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Área aproximada — o endereço com número só depois de o cliente aceitar */}
      {r.lat != null && r.lng != null && (
        <div className="mt-3">
          <AreaMap center={{ lat: r.lat, lng: r.lng }} radiusKm={1} height={140} />
          <p className="flex items-center gap-1.5 text-[11px] text-gray-light mt-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            Área aproximada (~1 km). O endereço exato aparece quando o cliente aceitar sua proposta.
          </p>
        </div>
      )}

      {/* EXPRESS: o profissional precisa saber ANTES de propor que aceitar
          significa sair agora — é o combinado que o cliente vê do outro lado. */}
      {r.urgent && (
        <div className="flex items-start gap-2 rounded-xl bg-danger/5 text-ink px-3.5 py-2.5 text-xs mt-3">
          <Zap className="h-4 w-4 shrink-0 text-danger" />
          <span>
            <b>Serviço EXPRESS.</b> O cliente precisa de atendimento <b>agora</b>. Só envie
            proposta se puder ir assim que ele aceitar.
          </span>
        </div>
      )}

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

      {sent ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-success/5 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
              <Check className="h-4 w-4" /> Proposta enviada: {brl(Number(value))}
              {freteNum > 0 && (
                <span className="font-normal text-gray">
                  + {brl(freteNum)} de deslocamento = <b className="text-ink">{brl(Number(value) + freteNum)}</b>
                </span>
              )}
            </span>
            {!waitingMe && !waitingThem && (
              <div className="flex items-center gap-3">
                <button onClick={() => setSent(false)} className="text-xs text-gray hover:text-ink underline">
                  alterar
                </button>
                <button
                  onClick={async () => {
                    setBusy(true);
                    const res = await cancelJobAsProvider(r.id);
                    setBusy(false);
                    if (!res.ok) return setError(res.error ?? "Não foi possível retirar.");
                    setSent(false);
                    setValue("");
                  }}
                  disabled={busy}
                  className="text-xs text-gray hover:text-danger underline disabled:opacity-50"
                >
                  retirar proposta
                </button>
              </div>
            )}
          </div>

          {waitingMe && counterPrice != null && (
            <div className="rounded-xl bg-info/5 border border-info/20 px-4 py-3">
              <p className="text-sm text-ink">
                O contratante fez uma <b>contra-proposta</b>: <b>{brl(counterPrice)}</b>
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Button size="sm" loading={busy} onClick={() => respondCounter(true)}>Aceitar {brl(counterPrice)}</Button>
                {!negociacaoNoLimite ? (
                  <button
                    onClick={() => { setShowCounter((v) => !v); setMyCounter(String(Math.round(((Number(value) || 0) + counterPrice) / 2))); }}
                    disabled={busy}
                    className="text-sm font-medium text-primary-dark hover:underline disabled:opacity-50"
                  >
                    Fazer outra proposta ({MAX_RODADAS - rodadas} restante{MAX_RODADAS - rodadas > 1 ? "s" : ""})
                  </button>
                ) : (
                  <span className="text-xs text-gray-light">
                    Limite de negociação atingido — aceite ou recuse.
                  </span>
                )}
                <button onClick={() => respondCounter(false)} disabled={busy} className="text-sm text-gray hover:text-danger">Recusar</button>
              </div>
              {showCounter && (
                <div className="flex items-end gap-2 mt-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-light">Seu novo valor (R$)</label>
                    <input
                      type="number"
                      value={myCounter}
                      onChange={(e) => setMyCounter(e.target.value)}
                      className="w-full h-10 rounded-xl border border-black/10 px-3 mt-1 outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <Button size="sm" loading={busy} onClick={sendMyCounter}>Enviar</Button>
                  <button onClick={() => setShowCounter(false)} className="text-xs text-gray hover:text-ink h-10">cancelar</button>
                </div>
              )}
            </div>
          )}
          {waitingThem && counterPrice != null && (
            <p className="text-xs text-info bg-info/5 rounded-lg px-3 py-2">
              Sua contra-proposta de <b>{brl(counterPrice)}</b> foi enviada — aguardando o contratante.
            </p>
          )}
          {counterStatus === "aceita" && (
            <p className="text-xs text-success">Negociação fechada em {brl(Number(value))} — aguardando o contratante confirmar.</p>
          )}
          {counterStatus === "recusada" && (
            <p className="text-xs text-gray-light">Contra-proposta recusada; vale a última proposta enviada.</p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}

          {/* Chat da negociação: um lado pede, o outro aceita */}
          <ServiceChatBox
            requestId={r.id}
            providerId={currentUserId}
            currentUserId={currentUserId}
            otherName={r.client?.full_name ?? "o cliente"}
          />
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-light">Seu preço para este serviço</label>
              <div className="flex items-center rounded-xl border border-black/10 px-3 mt-1 focus-within:border-primary">
                <span className="text-gray-light text-sm">R$</span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full py-2.5 px-2 outline-none"
                />
              </div>
            </div>
            <div className="w-32">
              <label className="text-xs text-gray-light">Deslocamento</label>
              <div className="flex items-center rounded-xl border border-black/10 px-3 mt-1 focus-within:border-primary">
                <span className="text-gray-light text-sm">R$</span>
                <input
                  type="number"
                  min={0}
                  value={frete}
                  onChange={(e) => setFrete(e.target.value)}
                  placeholder="0,00"
                  className="w-full py-2.5 px-2 outline-none"
                />
              </div>
            </div>
            <Button loading={busy} onClick={submit}>Enviar proposta</Button>
          </div>
          {freteNum > 0 && (
            <p className="text-[11px] text-gray-light mt-1.5">
              O cliente vê <b className="text-ink">{brl(price)}</b> de serviço
              {" + "}
              <b className="text-ink">{brl(freteNum)}</b> de deslocamento —
              total <b className="text-ink">{brl(price + freteNum)}</b>. Se ele cancelar depois
              de você sair para o local, o deslocamento é o piso do que fica com você.
            </p>
          )}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-light">Receber adiantado: <b className="text-ink">{advancePct}%</b> <span className="text-gray-light">(máx 50%)</span></label>
              <div className="flex gap-1">
                {[0, 25, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAdvancePct(p)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition ${advancePct === p ? "border-primary bg-primary/10 text-ink font-medium" : "border-black/10 text-gray"}`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <input type="range" min={0} max={50} step={5} value={advancePct} onChange={(e) => setAdvancePct(Number(e.target.value))} className="w-full accent-[#FFC107] mt-1" />
            <p className="text-[11px] text-gray-light">
              Quanto mais adiantado, maior a taxa. Você recebe (líquido): <b className="text-success">{brl(net)}</b>
              {advancePct > 0 && <> — sendo <b className="text-ink">{brl(Math.max((price * advancePct) / 100 - advanceFee - ((price * 0.15) * advancePct) / 100, 0))}</b> ao contratar</>}
            </p>
          </div>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Desistir de um serviço já aceito. O desfecho (devolver para a fila x estornar
 * o cliente) é decidido no SERVIDOR, pelo estado real do pagamento — aqui a
 * gente só explica antes e mostra o que aconteceu depois.
 */
function CancelarTrabalho({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setBusy(true);
    setErro("");
    const res = await cancelJobAsProvider(requestId, motivo.trim() || undefined);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível cancelar.");
    setConfirmando(false);
    router.refresh();
  }

  if (!confirmando) {
    return (
      <div className="px-5 pb-4 -mt-1">
        <button
          onClick={() => setConfirmando(true)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-light hover:text-danger transition"
        >
          <X className="h-3.5 w-3.5 shrink-0" /> Cancelar este trabalho
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4 -mt-1">
      <div className="rounded-xl bg-danger/5 border border-danger/20 p-3">
        <p className="text-xs text-ink">
          Se o cliente <b>ainda não pagou</b>, o pedido volta para a fila e outro profissional
          pode pegar. Se <b>já pagou</b>, o valor é estornado para ele e o serviço é cancelado.
        </p>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional) — ajuda o suporte"
          className="w-full h-9 px-3 mt-2 rounded-lg border border-black/10 text-sm outline-none focus:border-primary"
        />
        {erro && <p className="text-xs text-danger mt-2">{erro}</p>}
        <div className="flex items-center gap-3 mt-2">
          <Button size="sm" variant="danger" loading={busy} onClick={confirmar}>
            Confirmar cancelamento
          </Button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={busy}
            className="text-xs text-gray hover:text-ink"
          >
            voltar
          </button>
        </div>
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
