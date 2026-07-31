"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import type { CardPayload } from "@/app/app/contratante/pay.actions";

/**
 * Cartão via Checkout Transparente do Mercado Pago.
 *
 * O SDK do MP roda no navegador e transforma os dados do cartão em um TOKEN de
 * uso único. É esse token que vai para o nosso servidor — número, CVV e
 * validade do cartão NUNCA passam pelo Fixly (nem por log, nem por banco).
 */

interface MpClient {
  createCardToken(data: Record<string, string>): Promise<{ id: string }>;
  getPaymentMethods(opts: { bin: string }): Promise<{ results: { id: string; issuer?: { id: number } }[] }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => MpClient;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

function loadSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.MercadoPago) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.MercadoPago));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve(!!window.MercadoPago);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

const digits = (s: string) => s.replace(/\D/g, "");

export function CardForm({
  amount,
  onPay,
  busy,
}: {
  amount: number;
  onPay: (card: CardPayload) => void;
  busy: boolean;
}) {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const mpRef = useRef<MpClient | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tokenizing, setTokenizing] = useState(false);
  const [f, setF] = useState({ number: "", name: "", exp: "", cvv: "", doc: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!publicKey) return;
    let alive = true;
    loadSdk().then((ok) => {
      if (!alive) return;
      if (!ok || !window.MercadoPago) { setError("Não foi possível carregar o pagamento por cartão."); return; }
      mpRef.current = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      setReady(true);
    });
    return () => { alive = false; };
  }, [publicKey]);

  async function submit() {
    const mp = mpRef.current;
    if (!mp) return setError("Pagamento por cartão indisponível. Use o Pix.");
    const num = digits(f.number);
    const [mm, yy] = f.exp.split("/").map((s) => s?.trim() ?? "");
    if (num.length < 13) return setError("Número do cartão incompleto.");
    if (!f.name.trim()) return setError("Informe o nome impresso no cartão.");
    if (!mm || !yy) return setError("Validade no formato MM/AA.");
    if (digits(f.cvv).length < 3) return setError("CVV incompleto.");
    if (digits(f.doc).length !== 11) return setError("Informe o CPF do titular (11 dígitos).");

    setError("");
    setTokenizing(true);
    try {
      // descobre a bandeira/emissor pelos 6 primeiros dígitos
      const methods = await mp.getPaymentMethods({ bin: num.slice(0, 6) });
      const method = methods.results?.[0];

      const token = await mp.createCardToken({
        cardNumber: num,
        cardholderName: f.name.trim(),
        cardExpirationMonth: mm.padStart(2, "0"),
        cardExpirationYear: yy.length === 2 ? `20${yy}` : yy,
        securityCode: digits(f.cvv),
        identificationType: "CPF",
        identificationNumber: digits(f.doc),
      });
      setTokenizing(false);
      onPay({
        token: token.id,
        installments: 1,
        paymentMethodId: method?.id,
        issuerId: method?.issuer?.id ? String(method.issuer.id) : undefined,
        payerDocument: digits(f.doc),
      });
    } catch (e: any) {
      setTokenizing(false);
      setError(e?.message ?? "Não foi possível validar o cartão. Confira os dados.");
    }
  }

  if (!publicKey) {
    return (
      <p className="text-sm text-warning bg-warning/10 rounded-xl px-4 py-3">
        Pagamento por cartão ainda não configurado. Use o <b>Pix</b>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Número do cartão</Label>
        <Input
          value={f.number}
          onChange={set("number")}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
        />
      </div>
      <div>
        <Label>Nome impresso no cartão</Label>
        <Input value={f.name} onChange={set("name")} autoComplete="cc-name" placeholder="COMO ESTÁ NO CARTÃO" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Validade</Label>
          <Input value={f.exp} onChange={set("exp")} autoComplete="cc-exp" placeholder="MM/AA" />
        </div>
        <div>
          <Label>CVV</Label>
          <Input value={f.cvv} onChange={set("cvv")} inputMode="numeric" autoComplete="cc-csc" placeholder="123" />
        </div>
        <div>
          <Label>CPF do titular</Label>
          <Input value={f.doc} onChange={set("doc")} inputMode="numeric" placeholder="000.000.000-00" />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button fullWidth size="lg" loading={busy || tokenizing} disabled={!ready} onClick={submit}>
        <Lock className="h-4 w-4" /> Pagar com cartão
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-light">
        <CreditCard className="h-3.5 w-3.5" /> Os dados do cartão vão criptografados direto para o
        Mercado Pago — o Fixly não os armazena.
      </p>
      <p className="text-center text-xs text-gray-light">Total: {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
    </div>
  );
}
