"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare, CheckCircle2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { RouteMap } from "@/components/map/RouteMap";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { approveService } from "@/app/app/contratante/pay.actions";
import { brl } from "@/lib/pricing";

type Service = {
  id: string;
  description: string;
  status: string;
  urgent: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_price: number | null;
  final_price: number | null;
  rating: number | null;
  provider_id: string | null;
  category: { name: string; slug: string } | null;
  provider: { full_name: string; rating: number | null; jobs_done: number | null; lat: number | null; lng: number | null } | null;
  payment: { amount: number; fee: number; gateway_fee: number; provider_net: number; method: string; status: string } | null;
};

export function ServiceDetail({
  service,
  currentUserId,
  conversationId,
}: {
  service: Service;
  currentUserId: string;
  conversationId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(service.rating ?? 0);
  const [showChat, setShowChat] = useState(false);

  const inProgress = ["aceito", "a_caminho", "em_andamento"].includes(service.status);
  const done = service.status === "concluido";
  const dest = service.lat && service.lng ? { lat: service.lat, lng: service.lng } : { lat: -23.55, lng: -46.63 };
  const origin = service.provider?.lat && service.provider?.lng ? { lat: service.provider.lat, lng: service.provider.lng } : null;
  const val = service.final_price ?? service.estimated_price ?? 0;

  async function approve() {
    setBusy(true);
    try {
      await approveService(service.id);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  const canApprove = ["a_caminho", "em_andamento"].includes(service.status);

  async function rate(n: number) {
    setRating(n);
    const supabase = createClient();
    await supabase.from("service_requests").update({ rating: n }).eq("id", service.id);
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/app/contratante/historico" className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink">
              <CategoryIcon slug={service.category?.slug} className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-ink">{service.category?.name ?? "Serviço"}</p>
              <p className="text-sm text-gray-light">{service.address ?? "—"}</p>
            </div>
          </div>
          <Badge status={service.status} />
        </div>
        <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-4">{service.description}</p>
        {service.provider && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray">
            Profissional: <b className="text-ink">{service.provider.full_name}</b>
            <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" /> {(service.provider.rating ?? 5).toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Mapa */}
      {inProgress && (
        <RouteMap target={dest} targetKind="home" origin={origin} moverKind="wrench" requestGps showRoute={!!origin} height={260} />
      )}

      {/* Chat do serviço */}
      {conversationId && (
        <div>
          <Button variant="outline" fullWidth onClick={() => setShowChat((v) => !v)}>
            <MessageSquare className="h-4 w-4" /> {showChat ? "Ocultar conversa" : "Conversar com o profissional"}
            {!showChat && <UnreadBadge conversationId={conversationId} currentUserId={currentUserId} className="ml-1" />}
          </Button>
          {showChat && (
            <div className="mt-3">
              <ConversationThread conversationId={conversationId} currentUserId={currentUserId} height={380} />
            </div>
          )}
        </div>
      )}

      {/* Aprovar */}
      {inProgress && (
        <div className="flex items-center gap-2 rounded-xl bg-success/5 text-success px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" /> Pagamento protegido — o profissional só recebe após sua aprovação.
        </div>
      )}
      {canApprove && (
        <Button fullWidth size="lg" loading={busy} onClick={approve}>
          <CheckCircle2 className="h-5 w-5" /> Aprovar serviço e liberar pagamento
        </Button>
      )}

      {/* Extrato (só ao final) */}
      {done && (
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <h2 className="font-semibold text-ink mb-3">Extrato do serviço</h2>
          <div className="rounded-xl bg-canvas p-4 text-sm space-y-1.5">
            <Row label="Valor do serviço" value={brl(service.payment?.amount ?? val)} />
            <Row label="Comissão Fixly (15%)" value={`- ${brl(service.payment?.fee ?? 0)}`} muted />
            <Row label="Tarifa do pagamento" value={`- ${brl(service.payment?.gateway_fee ?? 0)}`} muted />
            <div className="border-t border-black/10 my-1" />
            <Row label="Recebido pelo profissional" value={brl(service.payment?.provider_net ?? 0)} />
            <div className="border-t border-black/10 my-1" />
            <Row label="Total pago" value={brl(service.payment?.amount ?? val)} bold />
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-ink mb-2">Sua avaliação</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)}>
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-black/15"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-gray-light" : "text-gray"}>{label}</span>
      <span className={bold ? "font-bold text-ink" : muted ? "text-gray-light" : "text-ink font-medium"}>{value}</span>
    </div>
  );
}
