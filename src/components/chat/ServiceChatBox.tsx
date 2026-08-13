"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Check, X, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { notifyChatInvite } from "@/app/app/notify.actions";

type Conv = { id: string; chat_status: string; requested_by: string | null };

/**
 * Conversa da NEGOCIAÇÃO (e, depois, do serviço).
 *
 * Regra combinada com o dono: uma das partes pede conversa, a outra aceita —
 * ninguém é obrigado a abrir um canal. Aceito, o chat vale para negociar o
 * preço e segue o serviço inteiro, então o histórico é um só, do primeiro
 * "olá" até a conclusão. Se ninguém pedir, ele nasce sozinho no aceite da
 * proposta (`accept_proposal` no banco).
 */
export function ServiceChatBox({
  requestId,
  providerId,
  currentUserId,
  otherName,
  height = 340,
}: {
  requestId: string;
  /** Profissional da conversa (o contratante pode ter uma com cada candidato). */
  providerId: string;
  currentUserId: string;
  otherName: string;
  height?: number;
}) {
  const [conv, setConv] = useState<Conv | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("conversations")
      .select("id, chat_status, requested_by")
      .eq("type", "servico")
      .eq("request_id", requestId)
      .eq("provider_id", providerId)
      .maybeSingle();
    setConv((data as Conv) ?? null);
    setLoading(false);
  }, [requestId, providerId]);

  useEffect(() => { load(); }, [load]);

  // enquanto o convite está pendente (ou não existe), vale conferir de tempos
  // em tempos: o outro lado pode aceitar a qualquer momento
  useEffect(() => {
    if (conv?.chat_status === "ativa") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [conv?.chat_status, load]);

  async function invite() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("request_service_chat", {
      p_request_id: requestId,
      p_provider: providerId,
    });
    setBusy(false);
    if (error) return setError(error.message);
    await notifyChatInvite(requestId, providerId);
    load();
  }

  async function respond(accept: boolean) {
    if (!conv) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("respond_chat_request", {
      p_conversation_id: conv.id,
      p_accept: accept,
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (accept) setOpen(true);
    load();
  }

  if (loading) return null;

  // ── ninguém pediu conversa ainda ──
  if (!conv) {
    return (
      <div className="mt-3">
        <button
          onClick={invite}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-dark hover:underline disabled:opacity-50"
        >
          <MessageSquare className="h-4 w-4" /> Pedir para conversar
        </button>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }

  // ── convite feito, esperando o outro lado ──
  if (conv.chat_status === "pendente") {
    const mine = conv.requested_by === currentUserId;
    return (
      <div className="mt-3 rounded-xl bg-info/5 border border-info/20 px-4 py-3">
        {mine ? (
          <p className="flex items-center gap-1.5 text-sm text-ink">
            <Clock className="h-4 w-4 shrink-0 text-info" />
            Convite para conversar enviado — aguardando {otherName} aceitar.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink">
              <b>{otherName}</b> quer conversar sobre este serviço.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Button size="sm" loading={busy} onClick={() => respond(true)}>
                <Check className="h-4 w-4" /> Aceitar conversa
              </Button>
              <button
                onClick={() => respond(false)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-sm text-gray hover:text-danger disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Recusar
              </button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }

  if (conv.chat_status === "recusada") {
    return (
      <p className="mt-3 text-xs text-gray-light">
        Conversa recusada. Vocês ainda podem negociar pelos valores acima.
      </p>
    );
  }

  if (conv.chat_status === "encerrada") {
    return <p className="mt-3 text-xs text-gray-light">Conversa encerrada (o serviço foi para outro profissional).</p>;
  }

  // ── ativa ──
  return (
    <div className="mt-3">
      <Button variant="outline" fullWidth onClick={() => setOpen((v) => !v)}>
        <MessageSquare className="h-4 w-4" /> {open ? "Ocultar conversa" : `Conversar com ${otherName.split(" ")[0]}`}
        {!open && <UnreadBadge conversationId={conv.id} currentUserId={currentUserId} className="ml-1" />}
      </Button>
      {open && (
        <div className="mt-3">
          <ConversationThread conversationId={conv.id} currentUserId={currentUserId} height={height} />
        </div>
      )}
    </div>
  );
}
