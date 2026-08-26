"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { brl } from "@/lib/pricing";
import { cancelService, previewCancel } from "@/app/(app)/app/contratante/pay.actions";
import type { ContaCancelamento, MotivoCancelamento } from "@/lib/cancellation";

/**
 * CANCELAR O SERVIÇO — com a conta na mesa.
 *
 * A caixa antiga dizia só "o valor será reembolsado" e cancelava. Isso deixou de
 * ser verdade quando a política do dono entrou em vigor: depois do aceite ficam
 * 30% retidos, depois do deslocamento 50% (ou o frete, o que for maior).
 * Cancelar com uma promessa de reembolso integral e devolver 70% seria a
 * reclamação mais cara que este produto poderia gerar.
 *
 * Então a caixa PERGUNTA ao servidor a conta antes de mostrar o botão. É o
 * mesmo cálculo que o cancelamento vai executar (`lib/cancellation.ts`), não
 * uma estimativa da tela — não há como as duas divergirem.
 *
 * Vai por PORTAL pelo mesmo motivo do `ConfirmDialog`: o cabeçalho do app tem
 * `backdrop-blur`, e um ancestral com `backdrop-filter` quebra o
 * `position: fixed` da caixa.
 */
export function CancelServiceDialog({
  open,
  requestId,
  isPaid,
  temProfissional,
  onClose,
}: {
  open: boolean;
  requestId: string;
  isPaid: boolean;
  /** Sem profissional designado não há no-show a declarar. */
  temProfissional: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [motivo, setMotivo] = useState<MotivoCancelamento>("desisti");
  const [detalhe, setDetalhe] = useState("");
  const [conta, setConta] = useState<ContaCancelamento | null>(null);
  const [prazo, setPrazo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => setMontado(true), []);

  /** A conta muda com o motivo (no-show do profissional devolve tudo). */
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setCarregando(true);
    setErro("");
    previewCancel(requestId, motivo)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) return setErro(r.error ?? "Não foi possível calcular o cancelamento.");
        setConta(r.conta ?? null);
        setPrazo(r.prazo ?? "");
      })
      .catch((e) => vivo && setErro(e?.message ?? "Não foi possível calcular o cancelamento."))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [open, requestId, motivo]);

  async function confirmar() {
    setBusy(true);
    setErro("");
    try {
      const res = await cancelService(requestId, { motivo, reason: detalhe.trim() || undefined });
      if (!res.ok) return setErro(res.error ?? "Não foi possível cancelar.");
      onClose();
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível cancelar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !montado) return null;

  const semCobranca = !isPaid || (conta?.total ?? 0) === 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10">
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(31,35,41,0.4)] animate-fade-up">
        <h3 className="text-lg font-bold text-ink">Cancelar {isPaid ? "serviço" : "pedido"}?</h3>

        {temProfissional && (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink mb-2">O que aconteceu?</p>
            <div className="space-y-2">
              <Opcao
                ativo={motivo === "desisti"}
                onClick={() => setMotivo("desisti")}
                titulo="Mudei de ideia / não preciso mais"
                desc="Segue a política de cancelamento pela etapa em que o serviço está."
              />
              <Opcao
                ativo={motivo === "no_show_profissional"}
                onClick={() => setMotivo("no_show_profissional")}
                titulo="O profissional não apareceu"
                desc="Reembolso integral e prioridade no reagendamento (item 5.2)."
              />
            </div>
          </div>
        )}

        {/* A CONTA — o coração desta caixa */}
        <div className="mt-4 rounded-xl border border-black/10 p-4">
          {carregando ? (
            <p className="text-sm text-gray">Calculando pela política de cancelamento…</p>
          ) : conta ? (
            <>
              <p className="text-sm text-gray leading-relaxed">{conta.resumo}</p>

              {/*
                ⚠️ A retenção da política pressupõe dinheiro pago. No Fixly o
                pagamento acontece DEPOIS do aceite, então existe uma janela em
                que o serviço já tem profissional (e a cláusula 3.2 já fala em
                30%) mas nada foi cobrado. Sem esta linha a caixa avisava que
                "fica retido 30%" de um valor que não existe — chamado de
                suporte garantido, e com razão.
              */}
              {semCobranca && conta.retido > 0 && !conta.apuracao && (
                <p className="mt-2 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-ink">
                  Como <b>você ainda não pagou nada</b> por este serviço, não há valor a reter nem
                  a estornar — o cancelamento não custa nada para você agora.
                </p>
              )}

              {!semCobranca && !conta.apuracao && (
                <div className="mt-3 space-y-1 text-sm">
                  <Linha label="Valor do serviço" valor={brl(conta.valorServico)} />
                  {conta.frete > 0 && <Linha label="Frete (deslocamento)" valor={brl(conta.frete)} />}
                  <Linha
                    label={conta.percentual > 0 ? `Fica retido (${Math.round(conta.percentual * 100)}%)` : "Fica retido"}
                    valor={brl(conta.retido)}
                    destaque={conta.retido > 0 ? "danger" : undefined}
                  />
                  <div className="border-t border-black/5 pt-1 mt-1">
                    <Linha label="Volta para você" valor={brl(conta.reembolso)} destaque="success" forte />
                  </div>
                  {conta.reembolso > 0 && prazo && (
                    <p className="text-[11px] text-gray-light pt-1">Prazo do estorno: {prazo}.</p>
                  )}
                </div>
              )}

              {conta.apuracao && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs text-ink">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-warning mt-px" />
                  <span>
                    O valor <b>continua retido</b> até o suporte apurar quanto do serviço foi
                    executado. Nada é liberado nem devolvido automaticamente.
                  </span>
                </div>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-light">
                <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                Política de cancelamento, item {conta.clausula}.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray">Seu pedido será cancelado. Esta ação não pode ser desfeita.</p>
          )}
        </div>

        <div className="mt-4">
          <label className="text-xs text-gray-light">Motivo (opcional — ajuda o suporte)</label>
          <input
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Ex.: consegui resolver sozinho"
            className="w-full h-10 px-3 mt-1 rounded-xl border border-black/10 text-sm outline-none focus:border-primary"
          />
        </div>

        {erro && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-px" /> {erro}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" fullWidth onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button variant="danger" fullWidth loading={busy} disabled={carregando} onClick={confirmar}>
            Sim, cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Opcao({
  ativo,
  onClick,
  titulo,
  desc,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-xl border p-3 text-left transition ${
        ativo ? "border-primary bg-primary/5" : "border-black/10 hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-medium text-ink">{titulo}</span>
      <span className="block text-[11px] text-gray-light mt-0.5">{desc}</span>
    </button>
  );
}

function Linha({
  label,
  valor,
  destaque,
  forte,
}: {
  label: string;
  valor: string;
  destaque?: "danger" | "success";
  forte?: boolean;
}) {
  const cor = destaque === "danger" ? "text-danger" : destaque === "success" ? "text-success" : "text-ink";
  return (
    <div className="flex justify-between">
      <span className="text-gray">{label}</span>
      <span className={`${cor} ${forte ? "font-bold" : "font-medium"}`}>{valor}</span>
    </div>
  );
}
