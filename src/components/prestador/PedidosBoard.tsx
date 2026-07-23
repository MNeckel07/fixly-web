"use client";

import { useState } from "react";
import { Inbox, User, MapPin, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/icons";
import { brl, providerNet, ADVANCE_FEE_RATE } from "@/lib/pricing";

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
  myProposal: { price: number; eta: number | null } | null;
};

export function PedidosBoard({
  requests,
  providerName,
  rating,
  jobsDone,
  basePrice,
  defaultAdvancePct = 0,
}: {
  requests: Req[];
  providerName: string;
  rating: number;
  jobsDone: number;
  basePrice: number;
  defaultAdvancePct?: number;
}) {
  const [online, setOnline] = useState(true);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink text-white p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-8 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-white/60 text-sm">Olá, {providerName.split(" ")[0]}</p>
            <p className="text-xl font-bold">{online ? "Você está online" : "Você está offline"}</p>
          </div>
          <button
            onClick={() => setOnline((v) => !v)}
            className={`h-8 w-14 rounded-full p-1 transition ${online ? "bg-success" : "bg-white/20"}`}
          >
            <span className={`block h-6 w-6 rounded-full bg-white transition ${online ? "translate-x-6" : ""}`} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 relative">
          <Stat label="Avaliação" value={jobsDone > 0 ? rating.toFixed(1) : "Novo"} />
          <Stat label="Serviços" value={String(jobsDone)} />
          <Stat label="Preço-base" value={brl(basePrice)} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Pedidos disponíveis</h2>
          <span className="text-sm text-gray-light">{requests.length} na sua região</span>
        </div>

        {!online ? (
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
              <RequestCard key={r.id} r={r} basePrice={basePrice} defaultAdvancePct={defaultAdvancePct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ r, basePrice, defaultAdvancePct }: { r: Req; basePrice: number; defaultAdvancePct: number }) {
  const [value, setValue] = useState<string>(String(r.myProposal?.price ?? basePrice));
  const [advancePct, setAdvancePct] = useState<number>(defaultAdvancePct);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(!!r.myProposal);
  const [error, setError] = useState("");
  const photos = r.photos ?? [];

  const price = Number(value) || 0;
  const advanceFee = Math.round(((price * advancePct) / 100) * ADVANCE_FEE_RATE * 100) / 100;
  const net = Math.max(providerNet(price || basePrice) - advanceFee, 0);

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
        <div className="mt-3 flex items-center justify-between rounded-xl bg-success/5 px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
            <Check className="h-4 w-4" /> Proposta enviada: {brl(Number(value))}
          </span>
          <button onClick={() => setSent(false)} className="text-xs text-gray hover:text-ink underline">
            alterar
          </button>
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
                  className="w-full py-2.5 px-2 outline-none"
                />
              </div>
            </div>
            <Button loading={busy} onClick={submit}>Enviar proposta</Button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-light">Receber adiantado: <b className="text-ink">{advancePct}%</b></label>
              <div className="flex gap-1">
                {[0, 30, 50, 100].map((p) => (
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
            <input type="range" min={0} max={100} step={5} value={advancePct} onChange={(e) => setAdvancePct(Number(e.target.value))} className="w-full accent-[#FFC107] mt-1" />
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
