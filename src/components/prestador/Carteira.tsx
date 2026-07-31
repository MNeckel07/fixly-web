"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Clock, Lock, Banknote, ArrowDownToLine, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { brl, settlementLabel } from "@/lib/pricing";
import { requestWithdrawal, type Balance } from "@/app/app/prestador/ganhos/actions";

export type Pending = {
  id: string;
  categoryName: string;
  net: number;
  availableAt: string | null;
  isAdvance: boolean;
};

export type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  paid_at: string | null;
  pix_key: string | null;
};

const WD_LABEL: Record<string, { text: string; tone: string }> = {
  solicitado: { text: "em processamento", tone: "text-warning" },
  pago: { text: "pago", tone: "text-success" },
  recusado: { text: "recusado", tone: "text-danger" },
};

/**
 * Carteira do prestador: o que já é dele, o que está a caminho, o que ainda
 * está retido em serviço — e o botão de sacar.
 */
export function Carteira({
  balance,
  pending,
  withdrawals,
  pixKey,
  gatewayConnected,
  gatewayAvailable,
}: {
  balance: Balance;
  pending: Pending[];
  withdrawals: Withdrawal[];
  pixKey: string | null;
  gatewayConnected: boolean;
  gatewayAvailable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    const amount = Number(value.replace(",", "."));
    if (!amount || amount <= 0) return setError("Informe um valor válido.");
    if (amount > balance.disponivel) return setError("Valor acima do saldo disponível.");
    setError("");
    setBusy(true);
    const res = await requestWithdrawal(amount);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível pedir o saque.");
    setDone(true);
    setOpen(false);
    setValue("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Saldo principal */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 text-ink">
        <p className="flex items-center gap-1.5 text-ink/70 text-sm">
          <Wallet className="h-4 w-4" /> Disponível para saque
        </p>
        <p className="text-4xl font-bold mt-1">{brl(balance.disponivel)}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> a liberar {brl(balance.a_liberar)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> em serviço {brl(balance.em_servico)}
          </span>
        </div>
        <div className="mt-5">
          <Button
            variant="dark"
            onClick={() => { setOpen((v) => !v); setError(""); setDone(false); }}
            disabled={balance.disponivel <= 0}
          >
            <ArrowDownToLine className="h-4 w-4" /> Sacar dinheiro
          </Button>
          {balance.disponivel <= 0 && (
            <p className="text-xs text-ink/60 mt-2">
              Você saca quando um serviço aprovado completar o prazo de crédito.
            </p>
          )}
        </div>
      </div>

      {done && (
        <p className="flex items-center gap-2 text-sm text-success bg-success/5 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-4 w-4" /> Saque solicitado! Cai na sua chave PIX em até 1 dia útil.
        </p>
      )}

      {/* Formulário de saque */}
      {open && (
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <h3 className="font-semibold text-ink">Sacar para o seu PIX</h3>
          {pixKey ? (
            <p className="text-sm text-gray-light mt-0.5">
              Chave PIX do cadastro: <b className="text-ink">{pixKey}</b>
            </p>
          ) : (
            <p className="text-sm text-danger mt-0.5">
              Você ainda não cadastrou uma chave PIX. Vá em Perfil e informe a chave antes de sacar.
            </p>
          )}
          <div className="flex items-end gap-2 mt-4">
            <div className="flex-1">
              <label className="text-xs text-gray-light">Valor</label>
              <div className="flex items-center rounded-xl border border-black/10 px-3 mt-1 focus-within:border-primary">
                <span className="text-gray-light text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  max={balance.disponivel}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full py-2.5 px-2 outline-none"
                />
              </div>
            </div>
            <Button loading={busy} onClick={submit} disabled={!pixKey}>Solicitar</Button>
          </div>
          <button
            onClick={() => setValue(String(balance.disponivel))}
            className="text-xs text-primary-dark font-medium mt-2 hover:underline"
          >
            Sacar tudo ({brl(balance.disponivel)})
          </button>
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>
      )}

      {/* Previsão de crédito — "o pagamento cai tal dia" */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold text-ink">A caminho da sua conta</h2>
            <p className="text-xs text-gray-light mt-0.5">
              Serviços aprovados aguardando o prazo de crédito do meio de pagamento.
            </p>
          </div>
          <ul className="divide-y divide-black/5">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm">{p.categoryName}</p>
                  <p className="text-xs text-warning">
                    {p.isAdvance ? "adiantamento · " : ""}
                    {p.availableAt ? `cai ${settlementLabel(p.availableAt)}` : "aguardando liberação"}
                  </p>
                </div>
                <span className="font-semibold text-ink shrink-0">{brl(p.net)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Histórico de saques */}
      {withdrawals.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold text-ink">Seus saques</h2>
          </div>
          <ul className="divide-y divide-black/5">
            {withdrawals.map((w) => {
              const label = WD_LABEL[w.status] ?? { text: w.status, tone: "text-gray" };
              return (
                <li key={w.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <p className="font-medium text-ink text-sm inline-flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-gray-light" /> {brl(Number(w.amount))}
                    </p>
                    <p className="text-xs text-gray-light">
                      {new Date(w.requested_at).toLocaleDateString("pt-BR")}
                      {w.pix_key ? ` · ${w.pix_key}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${label.tone}`}>{label.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Recebimento direto (split) — opcional */}
      {gatewayAvailable && (
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Link2 className="h-4 w-4" /> Receber direto na sua conta
          </p>
          {gatewayConnected ? (
            <p className="text-sm text-success mt-1">
              Conta Mercado Pago conectada — o valor do serviço cai direto para você, já com a
              comissão do Fixly descontada na hora.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray mt-1">
                Conectando sua conta Mercado Pago, o dinheiro do serviço vai direto para lá (sem
                precisar sacar). A comissão do Fixly é separada automaticamente.
              </p>
              <a
                href="/api/pagamentos/oauth/conectar"
                className="inline-flex items-center gap-2 h-10 px-4 mt-3 rounded-xl border border-black/10 text-sm font-semibold text-ink hover:bg-black/[0.03]"
              >
                Conectar Mercado Pago
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
