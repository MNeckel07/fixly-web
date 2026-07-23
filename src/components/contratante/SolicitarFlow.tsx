"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea, Input, Label } from "@/components/ui/Field";
import { LocationPicker } from "@/components/map/LocationPicker";
import { CategoryIcon } from "@/components/ui/icons";
import { PhotoPicker } from "@/components/contratante/PhotoPicker";
import { MapPin } from "lucide-react";
import { REFORMA_SLUGS, descriptionExample } from "@/lib/categoryRouter";
import { uploadRequestPhotos } from "@/lib/uploads";
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
  client,
}: {
  categories: ServiceCategory[];
  preselectSlug: string | null;
  initialDescription?: string;
  initialUrgent?: boolean;
  reformaOnly?: boolean;
  client: ClientInfo;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const preCat = preselectSlug ? categories.find((c) => c.slug === preselectSlug) ?? null : null;

  const [step, setStep] = useState<Step>(preCat ? "detalhes" : "categoria");
  const [category, setCategory] = useState<ServiceCategory | null>(preCat);
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

  // Envia o pedido (a plataforma NÃO define preço) e vai acompanhar as propostas
  async function submit() {
    if (!category) return;
    if (!description.trim()) return setError("Descreva o que você precisa.");
    if (!houseNumber.trim()) return setError("Informe o número da residência.");
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
        status: "buscando",
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

    // dispara para prestadores próximos (cada um envia seu preço)
    await supabase.rpc("dispatch_request", { p_request_id: req.id });

    router.push(`/app/contratante/servico/${req.id}`);
    router.refresh();
  }

  const shownCategories = reformaOnly
    ? categories.filter((c) => REFORMA_SLUGS.includes(c.slug))
    : categories;

  return (
    <div className="max-w-xl mx-auto">
      <Stepper step={step} />

      {step === "categoria" && (
        <Card title={reformaOnly ? "Reforma — o que você precisa?" : "O que você precisa?"} subtitle="Escolha a categoria do serviço">
          <div className="grid grid-cols-2 gap-3">
            {shownCategories.map((c) => (
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
                <span className="block font-medium text-ink text-sm">{c.name}</span>
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
                placeholder={descriptionExample(category.slug)}
              />
            </div>
            <div>
              <Label>Fotos do serviço</Label>
              <PhotoPicker files={photos} onChange={setPhotos} />
            </div>
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
            <div>
              <div className="flex items-center justify-between">
                <Label>Onde será o serviço?</Label>
                {hasCadastro && (
                  <button type="button" onClick={useCadastroAddress} className="inline-flex items-center gap-1 text-xs font-medium text-primary-dark hover:underline mb-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Usar endereço de cadastro
                  </button>
                )}
              </div>
              <LocationPicker value={loc} onChange={setLoc} onAddress={(a) => setAddress(a)} height={200} />
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
              <Label>Complemento (apto, bloco, referência)</Label>
              <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Ex.: Apto 42, bloco B — portão azul" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              {!preCat && <Button variant="ghost" onClick={() => setStep("categoria")}>← Voltar</Button>}
              <Button fullWidth loading={busy} onClick={submit}>Enviar pedido e ver propostas</Button>
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
