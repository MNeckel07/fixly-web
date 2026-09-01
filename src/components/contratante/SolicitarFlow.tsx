"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea, Input, Label } from "@/components/ui/Field";
import { LocationPicker } from "@/components/map/LocationPicker";
import { CategoryPicker } from "@/components/contratante/CategoryPicker";
import { PhotoPicker } from "@/components/contratante/PhotoPicker";
import { MapPin } from "lucide-react";
import { descriptionExample } from "@/lib/categoryRouter";
import { uploadRequestPhotos } from "@/lib/uploads";
import { notifyDirectRequest } from "@/app/(app)/app/notify.actions";
import type { ServiceCategory } from "@/lib/types";

type ClientInfo = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
};

type Step = "categoria" | "detalhes";

const DEFAULT_LOC = { lat: -23.5505, lng: -46.6333 }; // São Paulo

export function SolicitarFlow({
  categories,
  preselectSlug,
  initialDescription = "",
  initialUrgent = false,
  reformaOnly = false,
  mode = "express",
  provider = null,
  client,
}: {
  categories: ServiceCategory[];
  preselectSlug: string | null;
  initialDescription?: string;
  initialUrgent?: boolean;
  reformaOnly?: boolean;
  /** `orcamento` = serviço com visita técnica (reforma/orçamento). */
  mode?: "express" | "orcamento";
  /** Pedido direcionado a um profissional específico (vindo do Profiler). */
  provider?: { id: string; name: string; categorySlugs?: string[] } | null;
  client: ClientInfo;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const preCat = preselectSlug ? categories.find((c) => c.slug === preselectSlug) ?? null : null;

  /**
   * Pedido direto pelo Profiler: o cliente escolhe entre os serviços DAQUELE
   * profissional. Com um serviço só, não faz sentido perguntar — vai direto.
   */
  const catsDoProvider = provider?.categorySlugs?.length
    ? categories.filter((c) => provider.categorySlugs!.includes(c.slug))
    : null;
  const catalogo = catsDoProvider ?? categories;
  const catUnica = catsDoProvider?.length === 1 ? catsDoProvider[0] : null;

  /**
   * ⚠️ Com profissional escolhido, o `?cat=` da URL NÃO pula a escolha.
   *
   * O link do Profiler carrega a categoria PRINCIPAL dele, e isso travava o
   * pedido nela: "o Robson faz 27 serviços e só consigo puxar a alvenaria".
   * O pulo continua valendo quando ele realmente só faz uma coisa (`catUnica`)
   * e no fluxo normal, sem profissional, em que o `?cat=` veio de um clique do
   * próprio cliente na categoria.
   */
  const catInicial = catUnica ?? (provider && catalogo.length > 1 ? null : preCat);
  /** Já dentro dos detalhes, ainda dá para voltar e trocar o serviço. */
  const podeTrocarServico = catalogo.length > 1;

  const [step, setStep] = useState<Step>(catInicial ? "detalhes" : "categoria");
  const [category, setCategory] = useState<ServiceCategory | null>(catInicial);
  const [description, setDescription] = useState(initialDescription);
  const [urgent, setUrgent] = useState(initialUrgent);
  const [address, setAddress] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number }>(
    client.lat && client.lng ? { lat: client.lat, lng: client.lng } : DEFAULT_LOC,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasCadastro = !!(client.address || (client.lat && client.lng));
  function useCadastroAddress() {
    if (client.address) setAddress(client.address);
    if (client.addressNumber) setHouseNumber(client.addressNumber);
    if (client.complement) setComplement(client.complement);
    if (client.lat && client.lng) setLoc({ lat: client.lat, lng: client.lng });
  }

  /**
   * Envia o pedido. A plataforma NÃO define preço.
   *  - sem profissional escolhido → vai para os prestadores da região e o
   *    contratante compara PROPOSTAS (com negociação);
   *  - com profissional escolhido (veio do Profiler) → vai SÓ para ele
   *    (`target_provider_id`), e segue o mesmo caminho: ele manda a proposta,
   *    dá para negociar, contrapropor e conversar antes de fechar. Antes disso
   *    o pedido nascia "aceito" e não havia como discutir valor.
   */
  async function submit() {
    if (!category) return;
    if (!description.trim()) return setError("Descreva o que você precisa.");
    if (!houseNumber.trim()) return setError("Informe o número da residência.");
    if (!complement.trim()) return setError("Informe o complemento (apto/bloco ou uma referência).");
    setError("");
    setBusy(true);

    const fullAddress = [address, `nº ${houseNumber}`, complement.trim() ? `compl. ${complement.trim()}` : ""]
      .filter(Boolean)
      .join(", ");

    const { data: req, error: reqErr } = await supabase
      .from("service_requests")
      .insert({
        client_id: client.id,
        category_id: category.id,
        description,
        urgent,
        address: fullAddress,
        lat: loc.lat,
        lng: loc.lng,
        ...(mode === "orcamento" ? { mode: "orcamento" } : {}),
        status: "buscando",
        ...(provider ? { target_provider_id: provider.id } : {}),
      })
      .select("id")
      .single();

    if (reqErr || !req) {
      setBusy(false);
      return setError("Erro ao criar pedido: " + (reqErr?.message ?? ""));
    }

    // sobe as fotos (se houver) e grava os caminhos no pedido
    if (photos.length > 0) {
      const paths = await uploadRequestPhotos(supabase, client.id, req.id, photos);
      if (paths.length > 0) await supabase.from("service_requests").update({ photos: paths }).eq("id", req.id);
    }

    /**
     * O dispatch DEVOLVE quantos profissionais o pedido alcançou. Antes esse
     * número era jogado fora, e um pedido que não chegou em ninguém ficava
     * calado esperando proposta que nunca viria — o cliente só descobria
     * horas depois que não havia ninguém na categoria/raio dele.
     */
    const { data: alcance } = await supabase.rpc("dispatch_request", { p_request_id: req.id });

    /**
     * Pedido escolhido a dedo avisa o profissional por e-mail (Fixly 12).
     * Fica DEPOIS do dispatch porque é ele quem grava o alcance; e é
     * best-effort de propósito — e-mail que não sai não pode impedir o cliente
     * de chegar na tela do pedido que ele acabou de criar.
     */
    if (provider) {
      try { await notifyDirectRequest(req.id); } catch { /* avisar é melhor-esforço */ }
    }

    router.push(`/app/contratante/servico/${req.id}${Number(alcance) === 0 ? "?alcance=0" : ""}`);
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto">
      <Stepper step={step} />

      {provider && (
        <div className="flex items-center gap-2 rounded-xl bg-info/5 text-info px-4 py-3 text-sm mb-4">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>Pedido direcionado a <b>{provider.name}</b> — só ele recebe. Ele envia a proposta e vocês podem negociar e conversar antes de fechar.</span>
        </div>
      )}

      {step === "categoria" && (
        <Card
          title={
            provider
              ? `O que você precisa com ${provider.name.split(" ")[0]}?`
              : mode === "orcamento"
                ? "Solicitar orçamento para reforma"
                : "O que você precisa?"
          }
          subtitle={
            provider
              ? `Estes são os ${catalogo.length} serviços que ${provider.name.split(" ")[0]} atende`
              : "Escolha a categoria do serviço"
          }
        >
          <CategoryPicker
            categories={catalogo}
            reformaOnly={provider ? false : reformaOnly}
            todosAbertos={!!provider}
            onPick={(c) => {
              setCategory(c);
              setStep("detalhes");
            }}
          />
        </Card>
      )}

      {step === "detalhes" && category && (
        <Card
          title={category.name}
          subtitle={
            mode === "orcamento"
              ? "Conte o que precisa — os profissionais avaliam e mandam o orçamento"
              : "Conte os detalhes do serviço"
          }
        >
          <div className="space-y-4">
            <div>
              <Label>Descreva o que precisa</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={descriptionExample(category.slug)}
              />
            </div>
            <div>
              <Label>Fotos do serviço</Label>
              <PhotoPicker files={photos} onChange={setPhotos} />
            </div>
            {mode === "express" && (
              <button
                onClick={() => setUrgent((v) => !v)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 transition ${
                  urgent ? "border-danger bg-danger/5" : "border-black/10 bg-white"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <AlertTriangle className={`h-4 w-4 ${urgent ? "text-danger" : "text-gray-light"}`} />
                  É urgente? <span className="text-gray-light font-normal">(prioridade)</span>
                </span>
                <span className={`h-6 w-11 rounded-full p-0.5 transition ${urgent ? "bg-danger" : "bg-black/15"}`}>
                  <span className={`block h-5 w-5 rounded-full bg-white transition ${urgent ? "translate-x-5" : ""}`} />
                </span>
              </button>
            )}
            <div>
              <div className="flex items-center justify-between">
                <Label>Onde será o serviço?</Label>
                {hasCadastro && (
                  <button type="button" onClick={useCadastroAddress} className="inline-flex items-center gap-1 text-xs font-medium text-primary-dark hover:underline mb-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Usar endereço de cadastro
                  </button>
                )}
              </div>
              <LocationPicker
                value={loc}
                onChange={setLoc}
                onAddress={(a) => setAddress(a)}
                height={200}
                address={address}
                houseNumber={houseNumber}
                onHouseNumber={setHouseNumber}
                city={client.city}
              />
              <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-light">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success mt-px" />
                O endereço completo só é liberado para o profissional depois que
                você aceitar a proposta. Antes disso ele vê apenas a região.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Endereço (rua / referência)</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`Rua — ${client.city ?? "sua cidade"}`} />
              </div>
              <div>
                <Label>Número *</Label>
                <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="123" inputMode="numeric" />
              </div>
            </div>
            <div>
              <Label>Complemento (apto, bloco, referência) *</Label>
              <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Ex.: Apto 42, bloco B (ou 'casa')" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              {podeTrocarServico && <Button variant="ghost" onClick={() => setStep("categoria")}>← Trocar serviço</Button>}
              <Button fullWidth loading={busy} onClick={submit}>
                {provider
                  ? "Enviar pedido e conversar"
                  : mode === "orcamento"
                    ? "Enviar e receber orçamentos"
                    : "Enviar pedido e ver propostas"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── auxiliares de UI ── */
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 animate-fade-up">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-gray text-sm mt-0.5 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

const STEPS: { key: string; label: string }[] = [
  { key: "categoria", label: "Serviço" },
  { key: "detalhes", label: "Detalhes" },
  { key: "propostas", label: "Propostas" },
];

function Stepper({ step }: { step: Step }) {
  const order = ["categoria", "detalhes", "propostas"];
  const curIdx = order.indexOf(step);
  return (
    <div className="flex items-center justify-between mb-5 px-1">
      {STEPS.map((s, i) => {
        const active = curIdx >= order.indexOf(s.key);
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-ink" : "bg-black/10 text-gray-light"}`}>
                {i + 1}
              </div>
              <span className={`text-[10px] mt-1 ${active ? "text-ink" : "text-gray-light"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-4 ${active ? "bg-primary" : "bg-black/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}
