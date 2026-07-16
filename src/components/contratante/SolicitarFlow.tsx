"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock, Star, Car, Wrench, MessageSquare, CheckCircle2, MapPin, Zap, CreditCard, Smartphone, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea, Input, Label } from "@/components/ui/Field";
import { RouteMap } from "@/components/map/RouteMap";
import { LocationPicker } from "@/components/map/LocationPicker";
import { CategoryIcon } from "@/components/ui/icons";
import { REFORMA_SLUGS } from "@/lib/categoryRouter";
import {
  brl,
  estimateRange,
  haversineKm,
  paymentBreakdown,
  type PayMethod,
  type PriceRange,
  type PricingRule,
} from "@/lib/pricing";
import { processPayment, approveService } from "@/app/app/contratante/pay.actions";
import type { ServiceCategory } from "@/lib/types";

type Provider = {
  id: string;
  full_name: string;
  rating: number | null;
  jobs_done: number | null;
  base_price: number | null;
  lat: number | null;
  lng: number | null;
  category_id: string | null;
  bio: string | null;
};
type ClientInfo = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
};
type ProposalRow = {
  id: string;
  price: number;
  eta_minutes: number | null;
  provider: {
    id: string;
    full_name: string;
    rating: number | null;
    jobs_done: number | null;
    bio: string | null;
    lat: number | null;
    lng: number | null;
  };
};

type Step =
  | "categoria"
  | "detalhes"
  | "precificando"
  | "propostas"
  | "pagamento"
  | "acompanhamento"
  | "avaliacao";

const DEFAULT_LOC = { lat: -23.5505, lng: -46.6333 }; // São Paulo

export function SolicitarFlow({
  categories,
  providers,
  preselectSlug,
  initialDescription = "",
  initialUrgent = false,
  reformaOnly = false,
  client,
  pricingRules = {},
}: {
  categories: ServiceCategory[];
  providers: Provider[];
  preselectSlug: string | null;
  initialDescription?: string;
  initialUrgent?: boolean;
  reformaOnly?: boolean;
  client: ClientInfo;
  pricingRules?: Record<string, PricingRule>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const preCat = preselectSlug
    ? categories.find((c) => c.slug === preselectSlug) ?? null
    : null;

  const [step, setStep] = useState<Step>(preCat ? "detalhes" : "categoria");
  const [category, setCategory] = useState<ServiceCategory | null>(preCat);
  const [description, setDescription] = useState(initialDescription);
  const [urgent, setUrgent] = useState(initialUrgent);
  const [address, setAddress] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number }>(
    client.lat && client.lng ? { lat: client.lat, lng: client.lng } : DEFAULT_LOC,
  );
  const [geoMsg, setGeoMsg] = useState("");

  const [requestId, setRequestId] = useState<string | null>(null);
  const [estimated, setEstimated] = useState(0);
  const [range, setRange] = useState<PriceRange | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [chosen, setChosen] = useState<ProposalRow | null>(null);
  const [method, setMethod] = useState<PayMethod>("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // tracking
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [rating, setRating] = useState(0);

  function useMyLocation() {
    setGeoMsg("Localizando...");
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoMsg("Localização capturada");
      },
      () => setGeoMsg("Não foi possível — usando local padrão"),
    );
  }

  const distanceToNearest = useMemo(() => {
    const cands = providers.filter(
      (p) => p.lat && p.lng && (!category || p.category_id === category.id),
    );
    if (cands.length === 0) return 3;
    return Math.min(
      ...cands.map((p) => haversineKm(loc, { lat: p.lat!, lng: p.lng! })),
    );
  }, [providers, category, loc]);

  // ── Envia o pedido (sem preço da plataforma) e vai acompanhar as propostas ──
  async function startPricing() {
    if (!category) return;
    if (!description.trim()) {
      setError("Descreva o que você precisa.");
      return;
    }
    if (!houseNumber.trim()) {
      setError("Informe o número da residência.");
      return;
    }
    setError("");
    setBusy(true);

    const { data: req, error: reqErr } = await supabase
      .from("service_requests")
      .insert({
        client_id: client.id,
        category_id: category.id,
        description,
        urgent,
        address: [address, `nº ${houseNumber}`].filter(Boolean).join(", "),
        lat: loc.lat,
        lng: loc.lng,
        status: "buscando",
      })
      .select("id")
      .single();

    if (reqErr || !req) {
      setBusy(false);
      setError("Erro ao criar pedido: " + (reqErr?.message ?? ""));
      return;
    }

    // dispara para prestadores próximos (cada um envia seu preço)
    await supabase.rpc("dispatch_request", { p_request_id: req.id });

    // vai para a página do serviço: propostas, escolha, pagamento
    router.push(`/app/contratante/servico/${req.id}`);
    router.refresh();
  }

  // ── Passo: escolher proposta ──
  async function chooseProposal(p: ProposalRow) {
    setBusy(true);
    setChosen(p);
    await supabase
      .from("service_requests")
      .update({
        provider_id: p.provider.id,
        estimated_price: p.price,
        final_price: p.price,
        status: "aceito",
      })
      .eq("id", requestId!);
    await supabase
      .from("proposals")
      .update({ status: "recusada" })
      .eq("request_id", requestId!)
      .neq("id", p.id);
    await supabase.from("proposals").update({ status: "aceita" }).eq("id", p.id);
    setBusy(false);
    setStep("pagamento");
  }

  // ── Passo: pagamento (escrow) ──
  async function pay() {
    if (!chosen || !requestId) return;
    setBusy(true);
    setError("");
    const res = await processPayment(requestId, method);
    if (!res.ok) {
      setBusy(false);
      setError("Falha no pagamento: " + (res.error ?? ""));
      return;
    }
    // vai para a página persistente do serviço (acompanhamento, chat, extrato)
    router.push(`/app/contratante/servico/${requestId}`);
    router.refresh();
  }

  // anima o prestador chegando
  const started = useRef(false);
  useEffect(() => {
    if (step !== "acompanhamento" || started.current) return;
    started.current = true;
    const t = setInterval(() => {
      setProgress((v) => {
        if (v >= 1) {
          clearInterval(t);
          setArrived(true);
          supabase
            .from("service_requests")
            .update({ status: "em_andamento" })
            .eq("id", requestId!)
            .then(() => {});
          return 1;
        }
        return Math.min(1, v + 0.02);
      });
    }, 160);
    return () => clearInterval(t);
  }, [step, requestId, supabase]);

  async function finish() {
    if (!requestId) return;
    setBusy(true);
    await approveService(requestId);
    setBusy(false);
    setStep("avaliacao");
  }

  function openServiceChat() {
    if (!requestId) return;
    router.push(`/app/contratante/servico/${requestId}`);
  }

  async function submitRating() {
    if (requestId && rating > 0) {
      await supabase.from("service_requests").update({ rating }).eq("id", requestId);
    }
    router.push("/app/contratante/historico");
    router.refresh();
  }

  const providerLoc =
    chosen?.provider.lat && chosen?.provider.lng
      ? { lat: chosen.provider.lat, lng: chosen.provider.lng }
      : { lat: loc.lat + 0.02, lng: loc.lng + 0.02 };

  const bd = chosen ? paymentBreakdown(chosen.price, method) : null;

  const METHODS: { key: PayMethod; label: string; Icon: typeof Zap }[] = [
    { key: "pix", label: "Pix", Icon: Zap },
    { key: "cartao", label: "Cartão", Icon: CreditCard },
    { key: "apple_pay", label: "Apple Pay", Icon: Smartphone },
    { key: "google_pay", label: "Google Pay", Icon: Wallet },
  ];

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <div className="max-w-xl mx-auto">
      <Stepper step={step} />

      {step === "categoria" && (
        <Card title={reformaOnly ? "Reforma — o que você precisa?" : "O que você precisa?"} subtitle="Escolha a categoria do serviço">
          <div className="grid grid-cols-2 gap-3">
            {(reformaOnly ? categories.filter((c) => REFORMA_SLUGS.includes(c.slug)) : categories).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c);
                  setStep("detalhes");
                }}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas text-ink">
                  <CategoryIcon slug={c.slug} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium text-ink text-sm">{c.name}</span>
                  <span className="block text-xs text-gray-light">{brl(c.base_price)}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "detalhes" && category && (
        <Card title={category.name} subtitle="Conte os detalhes do serviço">
          <div className="space-y-4">
            <div>
              <Label>Descreva o que precisa</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Tomada da cozinha parou de funcionar e preciso resolver hoje."
              />
            </div>
            <button
              onClick={() => setUrgent((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border p-4 transition ${
                urgent ? "border-danger bg-danger/5" : "border-black/10 bg-white"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <AlertTriangle className={`h-4 w-4 ${urgent ? "text-danger" : "text-gray-light"}`} />
                É urgente? <span className="text-gray-light font-normal">(prioridade + taxa)</span>
              </span>
              <span
                className={`h-6 w-11 rounded-full p-0.5 transition ${urgent ? "bg-danger" : "bg-black/15"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition ${urgent ? "translate-x-5" : ""}`}
                />
              </span>
            </button>
            <div>
              <Label>Onde será o serviço?</Label>
              <LocationPicker
                value={loc}
                onChange={setLoc}
                onAddress={(a) => setAddress(a)}
                height={200}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Endereço (rua / referência)</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={`Rua — ${client.city ?? "sua cidade"}`}
                />
              </div>
              <div>
                <Label>Número *</Label>
                <Input
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                />
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("categoria")}>← Voltar</Button>
              <Button fullWidth loading={busy} onClick={startPricing}>Enviar pedido e ver propostas</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "precificando" && (
        <Card title="Calculando o melhor preço" subtitle="Analisando distância, urgência e demanda">
          <div className="flex flex-col items-center py-10">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-primary/30 animate-ping" />
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-ink">
                <CategoryIcon slug={category?.slug} className="h-9 w-9" />
              </span>
            </div>
            <p className="text-gray mt-8 animate-pulse">Buscando profissionais próximos...</p>
          </div>
        </Card>
      )}

      {step === "propostas" && (
        <Card
          title="Profissionais disponíveis"
          subtitle={`Pré-orçamento: ${range ? `${brl(range.min)} – ${brl(range.max)}` : brl(estimated)} · ${proposals.length} proposta(s)`}
        >
          {proposals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray">
                Nenhum profissional disponível nesta categoria no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-black/10 p-4 hover:border-primary transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas font-semibold text-ink">
                        {p.provider.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{p.provider.full_name}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-light">
                          <Star className="h-3 w-3 fill-primary text-primary" />
                          {(p.provider.rating ?? 5).toFixed(1)} · {p.provider.jobs_done ?? 0} serviços
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-ink">{brl(p.price)}</p>
                      <p className="text-xs text-gray-light">chega em ~{p.eta_minutes} min</p>
                    </div>
                  </div>
                  <Button
                    fullWidth
                    size="sm"
                    className="mt-3"
                    loading={busy && chosen?.id === p.id}
                    onClick={() => chooseProposal(p)}
                  >
                    Escolher e continuar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === "pagamento" && chosen && (
        <Card title="Pagamento protegido" subtitle="O valor fica retido até você aprovar o serviço">
          <Label>Forma de pagamento</Label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {METHODS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                  method === key ? "border-primary bg-primary/10 text-ink" : "border-black/10 text-gray"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-canvas p-4 mb-4">
            <Row label="Profissional" value={chosen.provider.full_name} />
            <Row label="Serviço" value={category?.name ?? "Serviço"} />
            <div className="border-t border-black/10 my-2" />
            <Row label="Valor do serviço" value={brl(chosen.price)} />
            <Row label="Comissão Fixly (15%)" value={`- ${brl(bd!.platformFee)}`} muted />
            <Row label="Tarifa do pagamento" value={`- ${brl(bd!.gatewayFee)}`} muted />
            <Row label="Prestador recebe" value={brl(bd!.providerNet)} />
            <div className="border-t border-black/10 my-2" />
            <Row label="Total a pagar" value={brl(chosen.price)} bold />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-success/5 text-success px-4 py-3 text-sm mb-4">
            <Lock className="h-4 w-4 shrink-0" />
            Pagamento protegido: o profissional só recebe após você confirmar a conclusão.
          </div>

          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <Button fullWidth size="lg" loading={busy} onClick={pay}>
            Pagar {brl(chosen.price)} e contratar
          </Button>
        </Card>
      )}

      {step === "acompanhamento" && chosen && (
        <Card
          title={arrived ? "Serviço em andamento" : "A caminho"}
          subtitle={
            arrived
              ? `${chosen.provider.full_name} chegou e está executando o serviço`
              : `${chosen.provider.full_name} está indo até você`
          }
        >
          <RouteMap
            target={loc}
            targetKind="home"
            origin={providerLoc}
            progress={progress}
            moverKind="wrench"
            requestGps
            showRoute
            height={280}
          />
          <div className="flex items-center gap-3 rounded-xl bg-canvas p-4 mt-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-dark">
              {arrived ? <Wrench className="h-5 w-5" /> : <Car className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink text-sm">
                {arrived ? "Trabalho em execução" : `${Math.round((1 - progress) * (chosen.eta_minutes ?? 20))} min para chegar`}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <Button variant="outline" fullWidth className="mt-3" onClick={openServiceChat}>
            <MessageSquare className="h-4 w-4" /> Conversar com o profissional
          </Button>
          {arrived && (
            <Button fullWidth size="lg" className="mt-3" loading={busy} onClick={finish}>
              <CheckCircle2 className="h-5 w-5" /> Aprovar serviço e liberar pagamento
            </Button>
          )}
        </Card>
      )}

      {step === "avaliacao" && (
        <Card title="Como foi o serviço?" subtitle="Sua avaliação ajuda a manter a qualidade">
          <div className="flex justify-center gap-2 py-6">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="transition">
                <Star className={`h-9 w-9 ${n <= rating ? "fill-primary text-primary" : "text-black/15"}`} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/5 text-success text-sm px-4 py-3 mb-4">
            <CheckCircle2 className="h-4 w-4" />
            Pagamento liberado ao profissional. Serviço concluído!
          </div>
          <Button fullWidth size="lg" onClick={submitRating}>
            Finalizar
          </Button>
        </Card>
      )}
    </div>
  );
}

/* ── auxiliares de UI ── */
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 animate-fade-up">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-gray text-sm mt-0.5 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className={muted ? "text-gray-light" : "text-gray"}>{label}</span>
      <span className={`${bold ? "font-bold text-ink text-base" : muted ? "text-gray-light" : "text-ink font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

const STEPS: { key: Step; label: string }[] = [
  { key: "categoria", label: "Serviço" },
  { key: "detalhes", label: "Detalhes" },
  { key: "propostas", label: "Propostas" },
];

function Stepper({ step }: { step: Step }) {
  const order = ["categoria", "detalhes", "precificando", "propostas", "pagamento", "acompanhamento", "avaliacao"];
  const curIdx = order.indexOf(step);
  return (
    <div className="flex items-center justify-between mb-5 px-1">
      {STEPS.map((s, i) => {
        const active = curIdx >= order.indexOf(s.key);
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-primary text-ink" : "bg-black/10 text-gray-light"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-[10px] mt-1 ${active ? "text-ink" : "text-gray-light"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${active ? "bg-primary" : "bg-black/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
