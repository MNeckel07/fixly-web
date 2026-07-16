"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare, CheckCircle2, Lock, ShieldCheck, BadgeCheck, ExternalLink, Zap, CreditCard, Smartphone, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { RouteMap } from "@/components/map/RouteMap";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { approveService, processPayment, cancelService } from "@/app/app/contratante/pay.actions";
import { brl, paymentBreakdown, type PayMethod } from "@/lib/pricing";

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
  mode: string | null;
  rating: number | null;
  review: string | null;
  provider_id: string | null;
  category: { name: string; slug: string } | null;
  provider: { full_name: string; rating: number | null; jobs_done: number | null; lat: number | null; lng: number | null } | null;
  payment: { amount: number; fee: number; gateway_fee: number; provider_net: number; method: string; status: string } | null;
};

type Proposal = {
  id: string;
  price: number;
  eta_minutes: number | null;
  provider: {
    id: string;
    full_name: string;
    handle: string | null;
    rating: number | null;
    jobs_done: number | null;
    category: { name: string; slug: string } | null;
  } | null;
};

const METHODS: { key: PayMethod; label: string; Icon: typeof Zap }[] = [
  { key: "pix", label: "Pix", Icon: Zap },
  { key: "cartao", label: "Cartão", Icon: CreditCard },
  { key: "apple_pay", label: "Apple Pay", Icon: Smartphone },
  { key: "google_pay", label: "Google Pay", Icon: Wallet },
];

export function ServiceDetail({
  service,
  currentUserId,
  conversationId,
  proposals = [],
}: {
  service: Service;
  currentUserId: string;
  conversationId: string | null;
  proposals?: Proposal[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(service.rating ?? 0);
  const [comment, setComment] = useState(service.review ?? "");
  const [reviewErr, setReviewErr] = useState("");
  const [reviewSent, setReviewSent] = useState(!!(service.rating && service.review));
  const [showChat, setShowChat] = useState(false);
  const [method, setMethod] = useState<PayMethod>("pix");
  const [payErr, setPayErr] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const canCancel = !["concluido", "cancelado"].includes(service.status);
  const isPaid = ["a_caminho", "em_andamento"].includes(service.status);

  async function cancel() {
    setBusy(true);
    await cancelService(service.id);
    setBusy(false);
    setShowCancel(false);
    router.refresh();
  }

  const awaiting = !service.provider_id && ["buscando", "proposta_enviada"].includes(service.status);
  const awaitingQuote = service.mode === "orcamento" && !!service.provider_id && !service.final_price && service.status !== "concluido";
  const toPay = service.status === "aceito" && !!service.final_price;

  async function choose(p: Proposal) {
    if (!p.provider) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("proposals").update({ status: "aceita" }).eq("id", p.id);
    await supabase
      .from("service_requests")
      .update({ provider_id: p.provider.id, final_price: p.price, status: "aceito" })
      .eq("id", service.id);
    setBusy(false);
    router.refresh();
  }

  async function pay() {
    setBusy(true);
    setPayErr("");
    const res = await processPayment(service.id, method);
    setBusy(false);
    if (!res.ok) return setPayErr(res.error ?? "Falha no pagamento.");
    router.refresh();
  }

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

  async function submitReview() {
    if (rating < 1) return setReviewErr("Dê uma nota de 1 a 5 estrelas.");
    if (comment.trim().length < 5) return setReviewErr("Escreva um comentário sobre o serviço.");
    setReviewErr("");
    setBusy(true);
    const supabase = createClient();
    await supabase.from("service_requests").update({ rating, review: comment.trim() }).eq("id", service.id);
    setBusy(false);
    setReviewSent(true);
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

      {/* Orçamento — aguardando o profissional enviar o valor */}
      {awaitingQuote && (
        <div className="flex items-start gap-2 rounded-2xl bg-info/5 text-info px-4 py-3 text-sm">
          <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <b>Orçamento em andamento.</b> Combine a visita técnica pelo chat abaixo. O profissional enviará o valor —
            quando chegar, você poderá pagar aqui.
          </span>
        </div>
      )}

      {/* Propostas recebidas — escolha o profissional */}
      {awaiting && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-ink">Propostas recebidas</h2>
            <span className="text-sm text-gray-light">{proposals.length} proposta(s)</span>
          </div>
          {proposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-gray">
              Aguardando os profissionais enviarem propostas. Atualize em instantes.
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => {
                const r = p.provider?.rating ?? 5;
                const elite = r >= 4.5;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-ink shrink-0">
                          <CategoryIcon slug={p.provider?.category?.slug} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-ink truncate">{p.provider?.full_name ?? "Profissional"}</p>
                            {elite && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                                <ShieldCheck className="h-3 w-3" /> Selo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray mt-0.5">
                            <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> {r.toFixed(1)}</span>
                            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> {p.provider?.jobs_done ?? 0} serviços</span>
                            {p.eta_minutes && <span>~{p.eta_minutes} min</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-ink">{brl(p.price)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {p.provider?.handle && (
                        <Link href={`/p/${p.provider.handle}`} target="_blank" className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-black/[0.03]">
                          Ver perfil e avaliações <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <Button className="flex-1" loading={busy} onClick={() => choose(p)}>Escolher</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagamento — após escolher o profissional */}
      {toPay && (
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <h2 className="font-semibold text-ink mb-1">Pagamento protegido</h2>
          <p className="text-sm text-gray-light mb-4">Você paga agora; o profissional só recebe após sua aprovação.</p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {METHODS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                  method === key ? "border-primary bg-primary/10 text-ink" : "border-black/10 text-gray"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {(() => {
            const bd = paymentBreakdown(service.final_price ?? val, method);
            return (
              <div className="rounded-xl bg-canvas p-4 text-sm space-y-1.5 mb-4">
                <Row label="Profissional" value={service.provider?.full_name ?? "—"} />
                <Row label="Valor do serviço" value={brl(bd.amount)} />
                <Row label="Comissão Fixly (15%)" value={`- ${brl(bd.platformFee)}`} muted />
                <Row label="Tarifa do pagamento" value={`- ${brl(bd.gatewayFee)}`} muted />
                <Row label="Prestador recebe" value={brl(bd.providerNet)} />
                <div className="border-t border-black/10 my-1" />
                <Row label="Total a pagar" value={brl(bd.amount)} bold />
              </div>
            );
          })()}

          {payErr && <p className="text-sm text-danger mb-3">{payErr}</p>}
          <Button fullWidth size="lg" loading={busy} onClick={pay}>
            <Lock className="h-4 w-4" /> Pagar {brl(service.final_price ?? val)} e contratar
          </Button>
        </div>
      )}

      {/* Mapa */}
      {inProgress && service.status !== "aceito" && (
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
      {["a_caminho", "em_andamento"].includes(service.status) && (
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
            <p className="text-sm font-medium text-ink mb-2">Sua avaliação {!reviewSent && <span className="text-danger">*</span>}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" disabled={reviewSent} onClick={() => setRating(n)}>
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-black/15"}`} />
                </button>
              ))}
            </div>
            {reviewSent ? (
              <p className="mt-3 text-sm text-gray bg-canvas rounded-xl px-4 py-3">“{comment}”</p>
            ) : (
              <div className="mt-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Conte como foi o serviço (obrigatório)"
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {reviewErr && <p className="text-xs text-danger mt-1">{reviewErr}</p>}
                <Button className="mt-2" size="sm" loading={busy} onClick={submitReview}>
                  Enviar avaliação
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancelar */}
      {canCancel && (
        <div className="text-center pt-1">
          <button onClick={() => setShowCancel(true)} className="text-sm text-gray hover:text-danger transition">
            Cancelar {isPaid ? "serviço" : "pedido"}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={showCancel}
        title={`Cancelar ${isPaid ? "serviço" : "pedido"}?`}
        description={isPaid ? "Como você já pagou, o valor será reembolsado. Esta ação não pode ser desfeita." : "Seu pedido será cancelado. Esta ação não pode ser desfeita."}
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        variant="danger"
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setShowCancel(false)}
      />
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
