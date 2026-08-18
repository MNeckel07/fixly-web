"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare, CheckCircle2, Lock, ShieldCheck, BadgeCheck, ExternalLink, Zap, CreditCard, AlertTriangle, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { RouteMap } from "@/components/map/RouteMap";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { approveService, approveAdvance, processPayment, skipPayment, cancelService, type CardPayload } from "@/app/app/contratante/pay.actions";
import { notifyCounter } from "@/app/app/notify.actions";
import { ServiceChatBox } from "@/components/chat/ServiceChatBox";
import { ReportButton } from "@/components/ui/ReportButton";
import { EditRequestDialog } from "@/components/contratante/EditRequestDialog";
import { WalletPayButton } from "@/components/contratante/WalletPayButton";
import { Zap as ZapIcon } from "lucide-react";
import { CardForm } from "@/components/contratante/CardForm";
import { PixPanel } from "@/components/contratante/PixPanel";
import { brl, paymentBreakdown, chargedTotal, type PayMethod } from "@/lib/pricing";
import { providerReputation } from "@/lib/reputation";

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
  /** Pedido mandado direto a um profissional (veio do Profiler). */
  target_provider_id: string | null;
  photos: string[] | null;
  advance_pct: number | null;
  advance_approved: boolean | null;
  /** Preenchido quando o profissional sinaliza que terminou (falta aprovar). */
  provider_done_at: string | null;
  /** Serviço que correu sem cobrança (Selo Fix nos dois lados). */
  no_charge: boolean | null;
  category: { name: string; slug: string } | null;
  provider: { full_name: string; rating: number | null; jobs_done: number | null; avatar_path: string | null; lat: number | null; lng: number | null } | null;
  payment: { amount: number; fee: number; gateway_fee: number; provider_net: number; method: string; status: string; advance_pct: number | null; advance_amount: number | null; advance_fee: number | null } | null;
};

type Proposal = {
  id: string;
  price: number;
  eta_minutes: number | null;
  advance_pct: number | null;
  counter_price: number | null;
  counter_status: string | null;
  /** Quem fez a última oferta pendente (contratante ou prestador). */
  counter_by: string | null;
  provider: {
    id: string;
    full_name: string;
    handle: string | null;
    rating: number | null;
    jobs_done: number | null;
    avatar_path: string | null;
    category: { name: string; slug: string } | null;
  } | null;
};

function avatarUrl(path: string | null | undefined): string | null {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : null;
}
// `service.photos` já chega como URLs assinadas (bucket privado `pedidos`).

/**
 * Apple Pay e Google Pay saíram daqui (31/07/2026).
 *
 * Eles estavam listados, mas caíam no MESMO formulário de cartão — o usuário
 * escolhia "Apple Pay" e recebia campos de número/CVV, que é o contrário do que
 * a carteira promete (autenticar no aparelho, sem digitar cartão).
 *
 * Para valer de verdade, a carteira precisa do **Payment Brick** do Mercado
 * Pago (o botão é renderizado por eles, o cartão nunca chega ao formulário) e,
 * no caso do Apple Pay, do domínio registrado na Apple + habilitação na conta
 * MP. É trabalho próprio, não um item de lista. Enquanto isso não existe, é
 * mais honesto não oferecer: o tipo `PayMethod` continua aceitando os dois,
 * então nada quebra quando forem implementados.
 */
const METHODS: { key: PayMethod; label: string; Icon: typeof Zap }[] = [
  { key: "pix", label: "Pix", Icon: Zap },
  { key: "cartao", label: "Cartão", Icon: CreditCard },
];

/**
 * Carteira do celular (Apple Pay / Google Pay). Roda no **Stripe** — o Mercado
 * Pago não oferece esses meios no Brasil. Só entra na lista quando o servidor
 * tem credencial, e o botão em si só aparece se o aparelho tiver carteira.
 */
const CARTEIRA: { key: PayMethod; label: string; Icon: typeof Zap } = {
  key: "google_pay",
  label: "Carteira",
  Icon: Smartphone,
};

export function ServiceDetail({
  service,
  currentUserId,
  conversationId,
  proposals = [],
  canSkipPayment = false,
  semAlcance = false,
  carteirasAtivas = false,
}: {
  service: Service;
  currentUserId: string;
  conversationId: string | null;
  proposals?: Proposal[];
  /** Selo Fix nos dois lados — libera seguir sem passar pelo gateway. */
  canSkipPayment?: boolean;
  /** O disparo não alcançou nenhum profissional (avisar em vez de deixar mudo). */
  semAlcance?: boolean;
  /** Stripe configurado no servidor — libera Apple Pay / Google Pay. */
  carteirasAtivas?: boolean;
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
  const [pix, setPix] = useState<{ code: string; base64?: string; expiresAt?: string } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState("");
  const [acceptErr, setAcceptErr] = useState("");

  /**
   * Contra-proposta do contratante. Passa pela RPC `counter_proposal`: a policy
   * de update em `proposals` virou admin-only, senão dava para reescrever o
   * PREÇO da proposta alheia e aceitar por outro valor.
   */
  async function sendCounter(p: Proposal) {
    const v = Number(counterValue);
    if (!v || v <= 0) return;
    setBusy(true);
    setAcceptErr("");
    const supabase = createClient();
    const { error } = await supabase.rpc("counter_proposal", { p_proposal_id: p.id, p_price: v });
    setBusy(false);
    if (error) return setAcceptErr(error.message);
    await notifyCounter(p.id);
    setCounterFor(null);
    setCounterValue("");
    router.refresh();
  }

  /** Resposta à contra-proposta que veio DO PRESTADOR. */
  async function answerCounter(p: Proposal, accept: boolean) {
    setBusy(true);
    setAcceptErr("");
    const supabase = createClient();
    const { error } = await supabase.rpc("respond_counter", { p_proposal_id: p.id, p_accept: accept });
    setBusy(false);
    if (error) return setAcceptErr(error.message);
    router.refresh();
  }

  async function doApproveAdvance() {
    setBusy(true);
    try {
      await approveAdvance(service.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /**
   * EXPRESS = urgente (v13). Modalidade de orçamento fica de fora: reforma com
   * pressa continua sendo reforma, o que muda é a prioridade, não o fato de
   * precisar de visita técnica.
   */
  const express = !!service.urgent && service.mode !== "orcamento";
  /** Editar só faz sentido enquanto ninguém aceitou o pedido. */
  const podeEditar = !service.provider_id && !["concluido", "cancelado"].includes(service.status);
  const canCancel = !["concluido", "cancelado"].includes(service.status);
  const isPaid = ["a_caminho", "em_andamento"].includes(service.status);

  const [cancelErr, setCancelErr] = useState("");

  /**
   * ⚠️ try/finally não é enfeite: qualquer erro do servidor aqui dentro
   * rejeitava a promessa e o `setBusy(false)` nunca rodava — o botão "Sim,
   * cancelar" girava para sempre e o pedido continuava de pé. E o erro
   * devolvido era ignorado, o que dava o mesmo sintoma sem exceção nenhuma.
   */
  async function cancel() {
    setBusy(true);
    setCancelErr("");
    try {
      const res = await cancelService(service.id);
      if (!res.ok) return setCancelErr(res.error ?? "Não foi possível cancelar.");
      setShowCancel(false);
      router.refresh();
    } catch (e: any) {
      setCancelErr(e?.message ?? "Não foi possível cancelar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const awaiting = !service.provider_id && ["buscando", "proposta_enviada"].includes(service.status);
  const awaitingQuote = service.mode === "orcamento" && !!service.provider_id && !service.final_price && service.status !== "concluido";
  const toPay = service.status === "aceito" && !!service.final_price;

  /**
   * Aceita a proposta. Vai pelo `accept_proposal` no banco, que:
   *  - recusa aceitar enquanto houver contra-proposta PENDENTE (era o bug de
   *    "mandei contraproposta e ele pulou pro pagamento com o valor antigo");
   *  - usa o preço da proposta (já negociado), não um valor vindo do cliente;
   *  - recusa as outras propostas do mesmo pedido.
   */
  async function accept(p: Proposal) {
    if (!p.provider) return;
    setBusy(true);
    setAcceptErr("");
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_proposal", { p_proposal_id: p.id });
    setBusy(false);
    if (error) return setAcceptErr(error.message);
    router.refresh();
  }

  async function pay(card?: CardPayload) {
    setBusy(true);
    setPayErr("");
    try {
      const res = await processPayment(service.id, method, card);
      if (!res.ok) return setPayErr([res.error, res.detail].filter(Boolean).join(" — ") || "Falha no pagamento.");
      // PIX volta pendente com QR: mostra o QR e espera a confirmação
      if (res.status === "pendente" && res.pixQrCode) {
        setPix({ code: res.pixQrCode, base64: res.pixQrCodeBase64, expiresAt: res.pixExpiresAt });
        return;
      }
      router.refresh();
    } catch (e: any) {
      setPayErr(e?.message ?? "Não conseguimos falar com o meio de pagamento. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  /** Selo Fix: segue o fluxo sem gateway. O servidor reconfere os dois selos. */
  async function skip() {
    setBusy(true);
    setPayErr("");
    try {
      const res = await skipPayment(service.id);
      if (!res.ok) return setPayErr(res.error ?? "Não foi possível seguir sem cobrança.");
      router.refresh();
    } catch (e: any) {
      setPayErr(e?.message ?? "Não foi possível seguir sem cobrança.");
    } finally {
      setBusy(false);
    }
  }

  const inProgress = ["aceito", "a_caminho", "em_andamento"].includes(service.status);
  const done = service.status === "concluido";
  const dest = service.lat && service.lng ? { lat: service.lat, lng: service.lng } : { lat: -23.55, lng: -46.63 };
  const origin = service.provider?.lat && service.provider?.lng ? { lat: service.provider.lat, lng: service.provider.lng } : null;
  const val = service.final_price ?? service.estimated_price ?? 0;

  const [approveErr, setApproveErr] = useState("");
  async function approve() {
    setBusy(true);
    setApproveErr("");
    try {
      const res = await approveService(service.id);
      if (!res.ok) return setApproveErr(res.error ?? "Não foi possível aprovar.");
      router.refresh();
    } catch (e: any) {
      setApproveErr(e?.message ?? "Não foi possível aprovar agora.");
    } finally {
      setBusy(false);
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
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-ink">{service.category?.name ?? "Serviço"}</p>
                {express && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                    <ZapIcon className="h-3 w-3" /> EXPRESS
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-light">{service.address ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {podeEditar && (
              <EditRequestDialog
                requestId={service.id}
                descricaoAtual={service.description}
                urgenteAtual={service.urgent}
                enderecoAtual={service.address}
              />
            )}
            <Badge status={service.status} />
          </div>
        </div>
        <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-4">{service.description}</p>
        {(service.photos ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(service.photos ?? []).map((ph) => (
              <a key={ph} href={ph} target="_blank" rel="noreferrer" className="h-20 w-20 rounded-xl overflow-hidden bg-canvas border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph} alt="Foto do serviço" className="h-full w-full object-cover hover:scale-105 transition" />
              </a>
            ))}
          </div>
        )}
        {service.provider && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray">
            Profissional: <b className="text-ink">{service.provider.full_name}</b>
            <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" /> {providerReputation(service.provider.rating, service.provider.jobs_done).label}</span>
          </div>
        )}
      </div>

      {/* Selo Fix — deixa explícito que este serviço não movimentou dinheiro */}
      {service.no_charge && (
        <div className="flex items-start gap-2 rounded-2xl bg-primary/10 text-ink px-4 py-3 text-sm">
          <BadgeCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <b>Serviço de cortesia.</b> Este atendimento correu sem cobrança: nada foi
            debitado de você.
          </span>
        </div>
      )}

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

      {semAlcance && awaiting && proposals.length === 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-warning/10 text-ink px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <span>
            <b>Nenhum profissional dessa categoria foi alcançado agora.</b> Seu pedido
            continua aberto e aparece assim que alguém da região ficar disponível. Se
            preferir, edite o pedido no lápis acima — mudar a categoria costuma resolver.
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
          {acceptErr && <p className="text-sm text-danger bg-danger/5 rounded-lg px-4 py-3 mb-3">{acceptErr}</p>}
          {express && proposals.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/5 text-ink px-4 py-3 text-sm mb-3">
              <ZapIcon className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
              <span>
                <b>Este pedido é EXPRESS.</b> Ao aceitar uma proposta, o profissional sai
                <b> agora</b> para o seu endereço. Só aceite se puder receber já.
              </span>
            </div>
          )}
          {proposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-gray">
              {service.target_provider_id
                ? "Pedido enviado direto para o profissional que você escolheu. Assim que ele mandar o valor, você poderá negociar e conversar por aqui — esta página se atualiza sozinha."
                : "Aguardando os profissionais enviarem propostas — esta página se atualiza sozinha."}
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => {
                const rep = providerReputation(p.provider?.rating, p.provider?.jobs_done);
                const elite = rep.elite;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {avatarUrl(p.provider?.avatar_path) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl(p.provider?.avatar_path)!} alt={p.provider?.full_name ?? ""} className="h-11 w-11 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-ink shrink-0">
                            <CategoryIcon slug={p.provider?.category?.slug} className="h-5 w-5" />
                          </div>
                        )}
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
                            <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> {rep.label}</span>
                            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> {p.provider?.jobs_done ?? 0} serviços</span>
                            {p.eta_minutes && <span>~{p.eta_minutes} min</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-ink">{brl(p.price)}</p>
                        {(p.advance_pct ?? 0) > 0 && (
                          <p className="text-[11px] text-gray-light">pede {p.advance_pct}% adiantado</p>
                        )}
                      </div>
                    </div>

                    {/* Negociação — vai e volta entre os dois lados */}
                    {p.counter_status === "pendente" && p.counter_by === currentUserId ? (
                      <p className="mt-3 text-xs text-info bg-info/5 rounded-lg px-3 py-2">
                        Contra-proposta de <b>{brl(p.counter_price ?? 0)}</b> enviada — aguardando o profissional.
                      </p>
                    ) : p.counter_status === "pendente" ? (
                      <div className="mt-3 rounded-xl bg-info/5 border border-info/20 px-3 py-2.5">
                        <p className="text-sm text-ink">
                          O profissional respondeu com <b>{brl(p.counter_price ?? 0)}</b>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <Button size="sm" loading={busy} onClick={() => answerCounter(p, true)}>
                            Aceitar {brl(p.counter_price ?? 0)}
                          </Button>
                          <button
                            onClick={() => { setCounterFor(p.id); setCounterValue(String(Math.round(((p.counter_price ?? 0) + p.price) / 2))); }}
                            className="text-sm font-medium text-primary-dark hover:underline"
                          >
                            Fazer outra proposta
                          </button>
                          <button onClick={() => answerCounter(p, false)} disabled={busy} className="text-sm text-gray hover:text-danger">
                            Recusar
                          </button>
                        </div>
                        {counterFor === p.id && (
                          <div className="flex items-end gap-2 mt-3">
                            <div className="flex-1">
                              <label className="text-xs text-gray-light">Seu novo valor (R$)</label>
                              <input type="number" value={counterValue} onChange={(e) => setCounterValue(e.target.value)} className="w-full h-10 rounded-xl border border-black/10 px-3 mt-1 outline-none focus:border-primary text-sm" />
                            </div>
                            <Button size="sm" loading={busy} onClick={() => sendCounter(p)}>Enviar</Button>
                            <button onClick={() => setCounterFor(null)} className="text-xs text-gray hover:text-ink h-10">cancelar</button>
                          </div>
                        )}
                      </div>
                    ) : p.counter_status === "recusada" ? (
                      <p className="mt-3 text-xs text-gray-light">O profissional recusou sua contra-proposta; vale {brl(p.price)}.</p>
                    ) : p.counter_status === "aceita" ? (
                      <p className="mt-3 text-xs text-success">Contra-proposta aceita — novo valor {brl(p.price)}.</p>
                    ) : counterFor === p.id ? (
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-light">Sua contra-proposta (R$)</label>
                          <input type="number" value={counterValue} onChange={(e) => setCounterValue(e.target.value)} placeholder={String(Math.round(p.price * 0.9))} className="w-full h-10 rounded-xl border border-black/10 px-3 mt-1 outline-none focus:border-primary text-sm" />
                        </div>
                        <Button size="sm" loading={busy} onClick={() => sendCounter(p)}>Enviar</Button>
                        <button onClick={() => setCounterFor(null)} className="text-xs text-gray hover:text-ink h-10">cancelar</button>
                      </div>
                    ) : null}

                    <div className="flex gap-2 mt-3">
                      {p.provider?.handle && (
                        <Link href={`/p/${p.provider.handle}`} target="_blank" className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-black/[0.03]">
                          Ver perfil <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {!p.counter_status && (
                        <button onClick={() => { setCounterFor(p.id); setCounterValue(""); }} className="flex-1 inline-flex items-center justify-center h-10 rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-black/[0.03]">
                          Negociar
                        </button>
                      )}
                      {/* Com negociação pendente NÃO se fecha o serviço:
                          o valor ainda está em discussão com o profissional. */}
                      {p.counter_status === "pendente" ? (
                        <span className="flex-1 inline-flex items-center justify-center h-10 rounded-xl bg-black/[0.04] text-gray-light text-sm font-medium">
                          Em negociação
                        </span>
                      ) : (
                        <Button className="flex-1" loading={busy} onClick={() => accept(p)}>
                          Aceitar proposta
                        </Button>
                      )}
                    </div>

                    {/* Conversa com este candidato (um pede, o outro aceita) */}
                    {p.provider && (
                      <ServiceChatBox
                        requestId={service.id}
                        providerId={p.provider.id}
                        currentUserId={currentUserId}
                        otherName={p.provider.full_name}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PIX gerado — aguardando o pagamento cair */}
      {toPay && pix && (
        <PixPanel
          requestId={service.id}
          qrCode={pix.code}
          qrCodeBase64={pix.base64}
          expiresAt={pix.expiresAt}
        />
      )}

      {/* Pagamento — após escolher o profissional */}
      {toPay && !pix && (
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <h2 className="font-semibold text-ink mb-1">Pagamento protegido</h2>
          <p className="text-sm text-gray-light mb-4">Você paga agora; o profissional só recebe após sua aprovação.</p>

          <div className={`grid ${carteirasAtivas ? "grid-cols-3" : "grid-cols-2"} gap-2 mb-4`}>
            {(carteirasAtivas ? [...METHODS, CARTEIRA] : METHODS).map(({ key, label, Icon }) => (
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
            const bd = paymentBreakdown(service.final_price ?? val, method, service.advance_pct ?? 0);
            return (
              <div className="rounded-xl bg-canvas p-4 text-sm space-y-1.5 mb-4">
                <Row label="Profissional" value={service.provider?.full_name ?? "—"} />
                <Row label="Valor do serviço" value={brl(bd.serviceAmount)} />
                {bd.surcharge > 0 && (
                  <Row label="Acréscimo do cartão" value={`+ ${brl(bd.surcharge)}`} muted />
                )}
                <div className="border-t border-black/10 my-1" />
                <Row label="Total a pagar" value={brl(bd.amount)} bold />
                <div className="border-t border-black/10 my-1" />
                <Row label="Taxa da plataforma (15%)" value={`- ${brl(bd.platformFee)}`} muted />
                {bd.advancePct > 0 && (
                  <>
                    <Row label={`Taxa de adiantamento (${bd.advancePct}%)`} value={`- ${brl(bd.advanceFee)}`} muted />
                    <Row label="Prestador recebe ao contratar" value={brl(bd.providerUpfront)} />
                    <Row label="Prestador recebe ao aprovar" value={brl(bd.providerOnApproval)} />
                  </>
                )}
                <Row label="Prestador recebe (total)" value={brl(bd.providerNet)} />
                {bd.surcharge > 0 && (
                  <p className="text-[11px] text-gray-light pt-1">
                    No Pix o total seria {brl(bd.serviceAmount)}. O acréscimo é a tarifa da
                    operadora do cartão — o profissional recebe o mesmo nos dois meios.
                  </p>
                )}
              </div>
            );
          })()}

          {payErr && <p className="text-sm text-danger mb-3">{payErr}</p>}

          {method === "pix" ? (
            <Button fullWidth size="lg" loading={busy} onClick={() => pay()}>
              <Lock className="h-4 w-4" /> Pagar {brl(service.final_price ?? val)} com Pix
            </Button>
          ) : method === "cartao" ? (
            <CardForm amount={chargedTotal(service.final_price ?? val, method)} busy={busy} onPay={(card) => pay(card)} />
          ) : (
            <WalletPayButton
              requestId={service.id}
              total={chargedTotal(service.final_price ?? val, method)}
              descricao={service.category?.name ?? "Serviço Fixly"}
              criarCobranca={async () => {
                const res = await processPayment(service.id, method);
                return { clientSecret: res.clientSecret, error: res.error };
              }}
              onPago={() => router.refresh()}
            />
          )}

          {/* SELO FIX — só aparece com selo nos dois lados (o servidor reconfere) */}
          {canSkipPayment && (
            <div className="mt-4 pt-4 border-t border-dashed border-black/10">
              <button
                onClick={skip}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-black/10 text-sm font-medium text-gray hover:text-ink hover:bg-black/[0.03] transition disabled:opacity-50"
              >
                <BadgeCheck className="h-4 w-4 shrink-0" />
                Seguir sem cobrança
              </button>
              <p className="text-[11px] text-gray-light text-center mt-2">
                Atendimento de cortesia: nada é cobrado de você.
              </p>
            </div>
          )}
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

      {/* Aprovar o adiantamento (se o profissional pediu) */}
      {["a_caminho", "em_andamento"].includes(service.status) && (service.advance_pct ?? 0) > 0 && !service.advance_approved && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <p className="font-semibold text-ink">Liberar adiantamento?</p>
          <p className="text-sm text-gray mt-1">
            O profissional pediu <b>{service.advance_pct}%</b> adiantado
            {service.payment?.advance_amount ? <> (<b>{brl(service.payment.advance_amount)}</b>)</> : null}. Você pode liberar
            essa parte agora para ele começar; o restante fica retido até você aprovar a conclusão.
          </p>
          <Button className="mt-3" loading={busy} onClick={doApproveAdvance}>Aprovar adiantamento</Button>
        </div>
      )}
      {["a_caminho", "em_andamento"].includes(service.status) && service.advance_approved && (service.advance_pct ?? 0) > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Adiantamento de {service.advance_pct}% liberado.</p>
      )}

      {/* Aprovar */}
      {["a_caminho", "em_andamento"].includes(service.status) && (
        <div className="flex items-center gap-2 rounded-xl bg-success/5 text-success px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" /> Pagamento protegido — o profissional só recebe após sua aprovação.
        </div>
      )}
      {/* O profissional sinalizou que terminou: falta a sua aprovação */}
      {canApprove && service.provider_done_at && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <p className="font-semibold text-ink">O profissional concluiu o serviço</p>
          <p className="text-sm text-gray mt-1">
            Confira se está tudo certo e aprove para liberar o pagamento. Se algo ficou pendente,
            fale com ele pelo chat antes de aprovar.
          </p>
        </div>
      )}
      {canApprove && (
        <>
          {approveErr && <p className="text-sm text-danger">{approveErr}</p>}
          <Button fullWidth size="lg" loading={busy} onClick={approve}>
            <CheckCircle2 className="h-5 w-5" /> Aprovar serviço e liberar pagamento
          </Button>
        </>
      )}

      {/* Extrato (só ao final) */}
      {done && (
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <h2 className="font-semibold text-ink mb-3">Extrato do serviço</h2>
          <div className="rounded-xl bg-canvas p-4 text-sm space-y-1.5">
            <Row label="Valor do serviço" value={brl(service.payment?.amount ?? val)} />
            <Row label="Taxa da plataforma (15%)" value={`- ${brl(service.payment?.fee ?? 0)}`} muted />
            <Row label="Tarifa do pagamento" value={`- ${brl(service.payment?.gateway_fee ?? 0)}`} muted />
            {(service.payment?.advance_pct ?? 0) > 0 && (
              <Row label={`Taxa de adiantamento (${service.payment?.advance_pct}%)`} value={`- ${brl(service.payment?.advance_fee ?? 0)}`} muted />
            )}
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
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Button size="sm" loading={busy} onClick={submitReview}>
                    Enviar avaliação
                  </Button>
                  {service.provider_id && service.provider && (
                    <ReportButton
                      targetId={service.provider_id}
                      targetName={service.provider.full_name}
                      requestId={service.id}
                      label="Algo grave aconteceu? Denunciar"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancelar / denunciar */}
      <div className="flex flex-col items-center gap-2 pt-1">
        {canCancel && (
          <button onClick={() => setShowCancel(true)} className="text-sm text-gray hover:text-danger transition">
            Cancelar {isPaid ? "serviço" : "pedido"}
          </button>
        )}
        {service.provider_id && service.provider && (
          <ReportButton
            targetId={service.provider_id}
            targetName={service.provider.full_name}
            requestId={service.id}
            label="Denunciar este profissional"
          />
        )}
      </div>
      <ConfirmDialog
        open={showCancel}
        title={`Cancelar ${isPaid ? "serviço" : "pedido"}?`}
        description={
          cancelErr
            ? cancelErr
            : isPaid
              ? "Como você já pagou, o valor será reembolsado. Esta ação não pode ser desfeita."
              : "Seu pedido será cancelado. Esta ação não pode ser desfeita."
        }
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
