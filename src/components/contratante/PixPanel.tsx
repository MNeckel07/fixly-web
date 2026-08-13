"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Clock, Loader2, AlertTriangle } from "lucide-react";
import { checkPaymentStatus } from "@/app/app/contratante/pay.actions";

/**
 * Tela do PIX: QR + copia-e-cola, e conferência automática do pagamento.
 *
 * A confirmação oficial vem pelo webhook do Mercado Pago. Este polling é a
 * rede de segurança: se o webhook atrasar ou falhar, o cliente não fica preso
 * olhando o QR — a própria tela pergunta ao gateway se já caiu.
 */
export function PixPanel({
  requestId,
  qrCode,
  qrCodeBase64,
  expiresAt,
  sandbox = false,
}: {
  requestId: string;
  qrCode: string;
  qrCodeBase64?: string;
  expiresAt?: string;
  /** Credencial de teste do gateway: o QR é real na forma, mas o banco recusa. */
  sandbox?: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      setChecking(true);
      const res = await checkPaymentStatus(requestId);
      if (!alive) return;
      setChecking(false);
      if (res.status === "retido") {
        clearInterval(timer);
        router.refresh();
      }
    }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [requestId, router]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* navegador sem permissão de clipboard */ }
  }

  return (
    <div className="bg-white rounded-2xl border border-primary/40 p-5">
      <h2 className="font-semibold text-ink">Pague com Pix para contratar</h2>
      <p className="text-sm text-gray-light mt-0.5 mb-4">
        Escaneie o QR no app do seu banco ou use o copia-e-cola. A confirmação é automática.
      </p>

      {sandbox && (
        <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 mb-4 text-xs text-ink">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>
            <b>Ambiente de teste.</b> Este QR é gerado com a credencial de teste do
            Mercado Pago — o app do banco vai dizer que o código é inválido. É o
            comportamento esperado; só uma conta de teste do MP paga este código.
            Com a credencial de produção o mesmo QR funciona normalmente.
          </span>
        </div>
      )}

      {qrCodeBase64 && (
        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code do Pix"
            className="h-52 w-52 rounded-xl border border-black/5 bg-white p-2"
          />
        </div>
      )}

      <label className="text-xs text-gray-light">Pix copia-e-cola</label>
      <div className="flex gap-2 mt-1">
        <input
          readOnly
          value={qrCode}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-black/10 bg-canvas text-xs text-gray outline-none"
        />
        <button
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink-soft"
        >
          {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
        </button>
      </div>

      <div className="flex items-center gap-2 mt-4 text-sm text-gray">
        {checking ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-dark" />
        ) : (
          <Clock className="h-4 w-4 text-gray-light" />
        )}
        <span>Aguardando o pagamento…</span>
        {expiresAt && (
          <span className="ml-auto text-xs text-gray-light">
            vence {new Date(expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
