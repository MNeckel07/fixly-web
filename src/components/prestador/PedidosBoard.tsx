"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, User, MapPin, Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { brl, providerNet, ADVANCE_FEE_RATE } from "@/lib/pricing";

/** Job já atribuído a este prestador (orçamento/reforma ou Express aceito). */
type MyJob = {
  id: string;
  description: string;
  status: string;
  address: string | null;
  mode: string | null;
  final_price: number | null;
  category: { name: string; slug: string } | null;
  client: { full_name: string; city: string | null } | null;
};

type Req = {
  id: string;
  description: string;
  urgent: boolean;
  address: string | null;
  estimated_price: number | null;
  estimated_min: number | null;
  estimated_max: number | null;
  lat: number | null;
  lng: number | null;
  photos: string[] | null;
  category: { name: string; slug: string } | null;
  client: { full_name: string; city: string | null } | null;
  myProposal: { price: number; eta: number | null; advance_pct: number; counter_price: number | null; counter_status: string | null } | null;
};

export function PedidosBoard({
  requests,
  myJobs = [],
  providerName,
  rating,
  jobsDone,
  monthNet,
  defaultAdvancePct = 0,
  busy = false,
}: {
  requests: Req[];
  myJobs?: MyJob[];
  providerName: string;
  rating: number;
  jobsDone: number;
  monthNet: number;
  defaultAdvancePct?: number;
  busy?: boolean;
}) {
  const [online, setOnline] = useState(true);
  const available = online && !busy;

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
          <Stat label="Ganhos no mês" value={brl(monthNet)} />
        </div>
      </div>

      {/* Orçamentos / reformas e serviços já seus — o contratante escolheu você direto */}
      {myJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Seus serviços e orçamentos</h2>
            <span className="text-sm text-gray-light">{myJobs.length} em aberto</span>
          </div>
          <div className="space-y-3">
            {myJobs.map((j) => (
              <Link
                key={j.id}
                href="/app/prestador/trabalho"
                className="block bg-white rounded-2xl border border-black/5 p-5 hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
                      <CategoryIcon slug={j.category?.slug} className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">{j.category?.name ?? "Serviço"}</p>
                        {j.mode === "orcamento" && (
                          <span className="text-[11px] font-bold text-info bg-info/10 px-2 py-0.5 rounded-full">ORÇAMENTO</span>
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
                    <Badge status={j.status} />
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
              <RequestCard key={r.id} r={r} defaultAdvancePct={defaultAdvancePct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ r, defaultAdvancePct }: { r: Req; defaultAdvancePct: number }) {
  // sem preço-base: o prestador digita o valor de cada serviço
  const [value, setValue] = useState<string>(r.myProposal ? String(r.myProposal.price) : "");
  const [advancePct, setAdvancePct] = useState<number>(Math.min(defaultAdvancePct, 50));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(!!r.myProposal);
  const [error, setError] = useState("");
  const [counterStatus, setCounterStatus] = useState<string | null>(r.myProposal?.counter_status ?? null);
  const counterPrice = r.myProposal?.counter_price ?? null;
  const photos = r.photos ?? [];

  async function respondCounter(accept: boolean) {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const patch = accept && counterPrice != null
      ? { price: counterPrice, counter_status: "aceita" }
      : { counter_status: "recusada" };
    const { error } = await supabase.from("proposals").update(patch).eq("request_id", r.id);
    setBusy(false);
    if (error) return setError(error.message);
    setCounterStatus(accept ? "aceita" : "recusada");
    if (accept && counterPrice != null) setValue(String(counterPrice));
  }

  const price = Number(value) || 0;
  const advanceFee = Math.round(((price * advancePct) / 100) * ADVANCE_FEE_RATE * 100) / 100;
  const net = Math.max(providerNet(price) - advanceFee, 0);

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
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink">
            <CategoryIcon slug={r.category?.slug} className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink">{r.category?.name ?? "Serviço"}</p>
              {r.urgent && (
                <span className="text-[11px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">URGENTE</span>
              )}
            </div>
            <p className="text-sm text-gray mt-0.5">{r.description}</p>
            <p className="flex items-center gap-1 text-xs text-gray-light mt-1">
              <User className="h-3.5 w-3.5" /> {r.client?.full_name ?? "Cliente"}
              <MapPin className="h-3.5 w-3.5 ml-1" /> {r.address || r.client?.city || "—"}
            </p>
          </div>
        </div>
      </div>

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
            </span>
            {counterStatus !== "pendente" && (
              <button onClick={() => setSent(false)} className="text-xs text-gray hover:text-ink underline">
                alterar
              </button>
            )}
          </div>

          {counterStatus === "pendente" && counterPrice != null && (
            <div className="rounded-xl bg-info/5 border border-info/20 px-4 py-3">
              <p className="text-sm text-ink">
                O contratante fez uma <b>contra-proposta</b>: <b>{brl(counterPrice)}</b>
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Button size="sm" loading={busy} onClick={() => respondCounter(true)}>Aceitar {brl(counterPrice)}</Button>
                <button onClick={() => respondCounter(false)} disabled={busy} className="text-sm text-gray hover:text-danger">Recusar</button>
              </div>
            </div>
          )}
          {counterStatus === "aceita" && (
            <p className="text-xs text-success">Contra-proposta aceita — novo valor {brl(Number(value))}.</p>
          )}
          {counterStatus === "recusada" && (
            <p className="text-xs text-gray-light">Você recusou a contra-proposta; vale sua proposta original.</p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
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
            <Button loading={busy} onClick={submit}>Enviar proposta</Button>
          </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-white/50">{label}</p>
    </div>
  );
}
