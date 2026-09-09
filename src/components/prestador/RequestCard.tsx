"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin, Check, Lock, Zap, Calculator } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/icons";
import { AreaMap } from "@/components/map/AreaMap";
import { ServiceChatBox } from "@/components/chat/ServiceChatBox";
import { brl, providerNet, ADVANCE_FEE_RATE } from "@/lib/pricing";
import { MAX_RODADAS_NEGOCIACAO as MAX_RODADAS } from "@/lib/negotiation";
import { cancelJobAsProvider } from "@/app/(app)/app/prestador/actions";
import { notifyCounter, notifyProposal } from "@/app/(app)/app/notify.actions";

/**
 * O CARD DE UM PEDIDO ABERTO — propor, negociar, retirar.
 *
 * Morava dentro de `PedidosBoard`. Saiu para cá no Fixly 13 porque passou a ser
 * usado nas DUAS abas: em *Pedidos*, para o que ainda não recebeu proposta
 * minha; em *Trabalho*, para o que já recebeu (pedido do dono, pág. 3). Nada do
 * comportamento mudou na mudança de arquivo.
 */
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
     * HERANÇA. A taxa de deslocamento acabou na 0039 (Fixly 13): hoje nasce
     * sempre 0 e nenhuma tela a coleta. O campo continua aqui só porque
     * propostas antigas, já pagas, ainda a carregam — apagá-lo esconderia o
     * valor de um extrato que existe.
     */
    travel_fee: number;
    counter_price: number | null;
    counter_status: string | null;
    counter_by: string | null;
    /** Quantas idas e voltas de VALOR já foram gastas (limite na 0036). */
    counter_rounds: number;
  } | null;
};

export type { Req };

export function RequestCard({
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
   * ⚠️ NÃO EXISTE MAIS CAMPO DE DESLOCAMENTO (Fixly 13, pág. 6).
   *
   * O dono deu a escolha — "ou colocar os 15% no deslocamento também ou tirar
   * o deslocamento" — e fechou por tirar. Agora é UM valor só, e a instrução
   * logo acima do campo manda o profissional embutir os custos (deslocamento
   * inclusive) antes de mandar o preço.
   *
   * A comissão volta a valer sobre tudo que foi combinado: enquanto a taxa
   * andava separada ela era, por desenho, a única parte fora dos 15% — e nada
   * impedia anunciar R$ 1 de serviço com R$ 300 de "deslocamento".
   */
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
  const advanceFee = Math.round(((price * advancePct) / 100) * ADVANCE_FEE_RATE * 100) / 100;
  /** Um valor só: a comissão de 15% incide sobre tudo que foi combinado. */
  const net = Math.max(providerNet(price) - advanceFee, 0);

  /** A negociação acabou: o último valor foi o dele. */
  const negociacaoNoLimite = rodadas >= MAX_RODADAS;

  async function submit() {
    if (!price || price <= 0) return setError("Informe um valor válido.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_proposal", {
      p_request_id: r.id,
      p_price: price,
      p_eta: null,
      p_message: null,
      p_advance_pct: advancePct,
      // 0 fixo: a taxa de deslocamento saiu (0039). O parâmetro continua na
      // assinatura só para não quebrar uma aba antiga que ainda o mande.
      p_travel_fee: 0,
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
            <a key={ph} href={ph} rel="noreferrer" className="h-16 w-16 rounded-lg overflow-hidden bg-canvas border border-black/5">
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
          {/*
            INSTRUÇÃO ANTES DO PREÇO (Fixly 13, pág. 6).

            Ela vem ACIMA do campo de propósito. Com a taxa de deslocamento
            removida, este é o único lugar onde o profissional decide se o
            serviço dá lucro — e ele precisa saber disso ANTES de digitar, não
            depois de enviar. Lida no fim, viraria só um aviso a que ninguém
            volta.
          */}
          <div className="flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-3 text-xs text-ink mb-3">
            <Calculator className="h-4 w-4 shrink-0 mt-px text-primary-dark" />
            <span>
              <b>Some TUDO num valor só.</b> Deslocamento, material, tempo de trabalho e
              o seu lucro entram neste preço — não existe cobrança à parte depois.
              Sobre ele incidem os 15% da Fixly, então feche a conta antes de enviar.
            </span>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-light">Seu preço final para este serviço</label>
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
            <Button loading={busy} onClick={submit}>Enviar proposta</Button>
          </div>
          {price > 0 && (
            <p className="text-[11px] text-gray-light mt-1.5">
              O cliente vê <b className="text-ink">{brl(price)}</b> — um valor único, sem
              acréscimo de deslocamento.
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
