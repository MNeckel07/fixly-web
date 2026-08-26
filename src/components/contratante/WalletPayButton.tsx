"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { confirmWalletPayment } from "@/app/(app)/app/contratante/pay.actions";

/**
 * Apple Pay / Google Pay pelo Stripe.
 *
 * O botão é renderizado pelo PRÓPRIO Stripe (exigência das duas carteiras: o
 * visual é padronizado pela Apple e pelo Google, e o cartão nunca chega ao
 * nosso formulário). Quem confirma é o aparelho, com digital ou Face ID.
 *
 * Se o aparelho não tiver carteira configurada, `canMakePayment()` devolve
 * nulo e a gente simplesmente não mostra nada — botão de carteira que não
 * funciona é pior do que não ter.
 */

type StripeJs = {
  paymentRequest(opts: Record<string, unknown>): StripePaymentRequest;
  elements(): { create(tipo: string, opts: Record<string, unknown>): StripeElement };
  confirmCardPayment(
    clientSecret: string,
    dados: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ): Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }>;
};
type StripePaymentRequest = {
  canMakePayment(): Promise<Record<string, boolean> | null>;
  on(evento: string, cb: (ev: any) => void): void;
};
type StripeElement = { mount(alvo: HTMLElement): void; on(e: string, cb: () => void): void };

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

const SDK = "https://js.stripe.com/v3/";

function carregarSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Stripe) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`);
    if (existente) {
      existente.addEventListener("load", () => resolve(!!window.Stripe));
      existente.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => resolve(!!window.Stripe);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function WalletPayButton({
  requestId,
  total,
  descricao,
  criarCobranca,
  onPago,
}: {
  requestId: string;
  /** Total já com a tarifa da carteira (o mesmo que aparece na tela). */
  total: number;
  descricao: string;
  /** Cria a intenção no servidor e devolve o segredo do Stripe. */
  criarCobranca: () => Promise<{ clientSecret?: string; error?: string }>;
  onPago: () => void;
}) {
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const alvoRef = useRef<HTMLDivElement>(null);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!publishable || !alvoRef.current) return;
    let vivo = true;

    carregarSdk().then((ok) => {
      if (!vivo || !ok || !window.Stripe) return setDisponivel(false);
      const stripe = window.Stripe(publishable);

      const pr = stripe.paymentRequest({
        country: "BR",
        currency: "brl",
        total: { label: descricao.slice(0, 60) || "Serviço Fixly", amount: Math.round(total * 100) },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then((resultado) => {
        if (!vivo) return;
        if (!resultado) return setDisponivel(false);
        setDisponivel(true);

        const botao = stripe.elements().create("paymentRequestButton", {
          paymentRequest: pr,
          style: { paymentRequestButton: { type: "default", theme: "dark", height: "48px" } },
        });
        if (alvoRef.current) botao.mount(alvoRef.current);
      });

      /**
       * O evento traz o meio de pagamento já autorizado pelo aparelho. A
       * ordem importa: criamos a intenção no servidor SÓ agora, quando já há
       * intenção real de pagar — assim não fica cobrança pendente atoa no
       * Stripe para quem só abriu a tela.
       */
      pr.on("paymentmethod", async (ev: any) => {
        setProcessando(true);
        setErro("");
        try {
          const criada = await criarCobranca();
          if (!criada.clientSecret) {
            ev.complete("fail");
            setErro(criada.error ?? "Não foi possível iniciar o pagamento.");
            return;
          }

          const { error, paymentIntent } = await stripe.confirmCardPayment(
            criada.clientSecret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false },
          );
          if (error) {
            ev.complete("fail");
            setErro(error.message ?? "Pagamento não autorizado.");
            return;
          }
          ev.complete("success");

          // o servidor reconfere no Stripe antes de dar o serviço como pago
          const res = await confirmWalletPayment(requestId, paymentIntent!.id);
          if (!res.ok) return setErro(res.error ?? "Pagamento feito, mas não conseguimos confirmar. Fale com o suporte.");
          onPago();
        } catch (e: any) {
          try { ev.complete("fail"); } catch { /* o evento pode já ter sido fechado */ }
          setErro(e?.message ?? "Não foi possível concluir o pagamento.");
        } finally {
          setProcessando(false);
        }
      });
    });

    return () => { vivo = false; };
  }, [publishable, total, descricao, requestId, criarCobranca, onPago]);

  if (!publishable || disponivel === false) return null;

  return (
    <div className="space-y-2">
      <div ref={alvoRef} />
      {disponivel === null && (
        <p className="flex items-center justify-center gap-2 text-xs text-gray-light">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procurando carteira no seu aparelho…
        </p>
      )}
      {processando && (
        <p className="flex items-center justify-center gap-2 text-sm text-gray">
          <Loader2 className="h-4 w-4 animate-spin" /> Confirmando o pagamento…
        </p>
      )}
      {erro && <p className="text-sm text-danger">{erro}</p>}
      {disponivel && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-light">
          <Smartphone className="h-3.5 w-3.5" /> Pague com a digital do seu celular — sem digitar cartão.
        </p>
      )}
    </div>
  );
}
