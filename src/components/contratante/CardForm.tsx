"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Lock, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import type { CardPayload } from "@/app/app/contratante/pay.actions";
import { listSavedCards, removeSavedCard } from "@/app/app/contratante/cards.actions";
import type { SavedCard } from "@/lib/types";

/**
 * Cartão via Checkout Transparente do Mercado Pago.
 *
 * O SDK do MP roda no navegador e transforma os dados do cartão em um TOKEN de
 * uso único. É esse token que vai para o nosso servidor — número, CVV e
 * validade do cartão NUNCA passam pelo Fixly (nem por log, nem por banco).
 *
 * CARTÃO SALVO: o cartão guardado vive no Mercado Pago, não aqui. Para cobrar
 * de novo, o navegador gera um token a partir do `cardId` + **CVV** — o código
 * de segurança é pedido toda vez, por exigência do MP; é o que impede que um
 * cartão guardado seja usado por quem não tem o plástico na mão.
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

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [savedCvv, setSavedCvv] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const [saveNew, setSaveNew] = useState(true);
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

  useEffect(() => {
    let alive = true;
    listSavedCards().then((list) => {
      if (!alive) return;
      setCards(list);
      setSelected(list[0]?.id ?? null);
      setLoadingCards(false);
    });
    return () => { alive = false; };
  }, []);

  /** Cobrança num cartão já guardado: só o CVV é pedido. */
  async function payWithSaved() {
    const mp = mpRef.current;
    if (!mp || !selected) return;
    if (digits(savedCvv).length < 3) return setError("Informe o código de segurança (CVV).");
    setError("");
    setTokenizing(true);
    try {
      const card = cards.find((c) => c.id === selected);
      const token = await mp.createCardToken({ cardId: selected, securityCode: digits(savedCvv) });
      setTokenizing(false);
      onPay({
        token: token.id,
        installments: 1,
        paymentMethodId: card?.brand,
        savedCardId: selected,
      });
    } catch (e: any) {
      setTokenizing(false);
      setError(e?.message ?? "Não foi possível usar este cartão. Confira o CVV.");
    }
  }

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

      const dados = {
        cardNumber: num,
        cardholderName: f.name.trim(),
        cardExpirationMonth: mm.padStart(2, "0"),
        cardExpirationYear: yy.length === 2 ? `20${yy}` : yy,
        securityCode: digits(f.cvv),
        identificationType: "CPF",
        identificationNumber: digits(f.doc),
      };

      const token = await mp.createCardToken(dados);
      // Token do MP é de USO ÚNICO: o da cobrança morre na cobrança. Para
      // guardar o cartão é preciso um segundo, gerado aqui enquanto os dados
      // ainda estão na tela (nunca no servidor).
      const saveToken = saveNew ? await mp.createCardToken(dados).catch(() => null) : null;

      setTokenizing(false);
      onPay({
        token: token.id,
        installments: 1,
        paymentMethodId: method?.id,
        issuerId: method?.issuer?.id ? String(method.issuer.id) : undefined,
        payerDocument: digits(f.doc),
        ...(saveToken ? { saveCardToken: saveToken.id } : {}),
      });
    } catch (e: any) {
      setTokenizing(false);
      setError(e?.message ?? "Não foi possível validar o cartão. Confira os dados.");
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    const res = await removeSavedCard(id);
    setRemoving(null);
    if (!res.ok) return setError(res.error ?? "Não foi possível remover o cartão.");
    setCards((prev) => {
      const restantes = prev.filter((c) => c.id !== id);
      setSelected((sel) => (sel === id ? restantes[0]?.id ?? null : sel));
      return restantes;
    });
  }

  if (!publicKey) {
    return (
      <p className="text-sm text-warning bg-warning/10 rounded-xl px-4 py-3">
        Pagamento por cartão ainda não configurado. Use o <b>Pix</b>.
      </p>
    );
  }

  const usandoSalvo = selected !== null;

  return (
    <div className="space-y-3">
      {/* Cartões já guardados */}
      {!loadingCards && cards.length > 0 && (
        <div className="space-y-2">
          <Label>Seus cartões</Label>
          {cards.map((c) => {
            const ativo = selected === c.id;
            return (
              <div
                key={c.id}
                className={`rounded-xl border transition ${ativo ? "border-primary bg-primary/5" : "border-black/10"}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => { setSelected(c.id); setSavedCvv(""); setError(""); }}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${ativo ? "border-primary bg-primary text-ink" : "border-black/20"}`}>
                      {ativo && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <CreditCard className="h-4 w-4 shrink-0 text-gray" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">
                        {c.brandName} •••• {c.lastFour}
                      </span>
                      <span className="block text-[11px] text-gray-light">
                        vence {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}
                        {c.holder ? ` · ${c.holder}` : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={removing === c.id}
                    aria-label="Remover cartão"
                    className="shrink-0 p-2 text-gray-light hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {ativo && (
                  <div className="flex items-end gap-2 px-4 pb-4">
                    <div className="w-28">
                      <Label>CVV</Label>
                      <Input
                        value={savedCvv}
                        onChange={(e) => setSavedCvv(e.target.value)}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                      />
                    </div>
                    <p className="pb-3 text-[11px] text-gray-light">
                      Por segurança, o código do cartão é pedido a cada pagamento.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => { setSelected(null); setError(""); }}
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${usandoSalvo ? "text-primary-dark hover:underline" : "text-gray-light"}`}
          >
            <Plus className="h-4 w-4" /> Usar outro cartão
          </button>
        </div>
      )}

      {/* Cartão novo */}
      {!usandoSalvo && (
        <>
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

          <button
            type="button"
            onClick={() => setSaveNew((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 px-4 py-3 text-left"
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${saveNew ? "border-primary bg-primary text-ink" : "border-black/20"}`}>
              {saveNew && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className="text-sm text-ink">
              Salvar este cartão para as próximas contratações
              <span className="block text-[11px] text-gray-light">
                Guardado com segurança pelo Mercado Pago — o Fixly não vê os números.
              </span>
            </span>
          </button>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        fullWidth
        size="lg"
        loading={busy || tokenizing}
        disabled={!ready}
        onClick={usandoSalvo ? payWithSaved : submit}
      >
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
