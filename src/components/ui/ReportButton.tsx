"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createReport } from "@/app/app/report.actions";
import { MOTIVOS, type MotivoDenuncia } from "@/lib/reports";

/**
 * Botão "Denunciar" — aparece na tela do serviço e na hora de avaliar.
 *
 * Discreto de propósito (link pequeno, não um botão vermelho): ele precisa
 * existir e ser fácil de achar quando necessário, sem sugerir que denunciar é
 * o desfecho comum de um serviço.
 *
 * Igual ao ConfirmDialog, o modal vai por PORTAL: o cabeçalho do app tem
 * `backdrop-blur`, e isso quebra `position: fixed` de qualquer filho.
 */
export function ReportButton({
  targetId,
  targetName,
  requestId,
  label = "Denunciar",
  className = "",
}: {
  targetId: string;
  targetName: string;
  requestId?: string | null;
  label?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDenuncia | "">("");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  async function enviar() {
    if (!motivo) return setErro("Selecione um motivo.");
    setBusy(true);
    setErro("");
    const res = await createReport({
      targetId,
      requestId: requestId ?? null,
      category: motivo,
      description: texto,
    });
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível registrar.");
    setEnviada(true);
  }

  function fechar() {
    setAberto(false);
    setTimeout(() => { setEnviada(false); setMotivo(""); setTexto(""); setErro(""); }, 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`inline-flex items-center gap-1.5 text-xs text-gray-light hover:text-danger transition ${className}`}
      >
        <Flag className="h-3.5 w-3.5 shrink-0" /> {label}
      </button>

      {aberto && montado &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={fechar} />
            <div className="relative w-full max-w-md translate-y-6 rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(31,35,41,0.4)] animate-fade-up">
              {enviada ? (
                <div className="text-center py-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-ink mt-3">Denúncia registrada</h3>
                  <p className="text-sm text-gray mt-1.5">
                    A equipe do Fixly vai analisar. Se for o caso, a conta denunciada perde o
                    Selo, é suspensa ou encerrada. Você não precisa fazer mais nada.
                  </p>
                  <Button className="mt-5" fullWidth onClick={fechar}>Fechar</Button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-ink">Denunciar {targetName}</h3>
                  <p className="mt-1.5 text-sm text-gray">
                    Conte o que aconteceu. A denúncia é <b>sigilosa</b> — a pessoa denunciada
                    não vê quem denunciou nem o conteúdo.
                  </p>

                  <div className="mt-4 space-y-1.5">
                    {MOTIVOS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMotivo(m.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                          motivo === m.id ? "border-danger bg-danger/5 text-ink" : "border-black/10 text-gray hover:bg-black/[0.02]"
                        }`}
                      >
                        <span className={`h-4 w-4 shrink-0 rounded-full border ${motivo === m.id ? "border-[5px] border-danger" : "border-black/20"}`} />
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={3}
                    placeholder="O que aconteceu? Quanto mais detalhe (data, valores, o que foi dito), mais rápido a apuração."
                    className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
                  />

                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-light">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
                    Em caso de crime, risco à vida ou emergência, procure também a polícia (190).
                  </p>

                  {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}

                  <div className="mt-5 flex gap-2">
                    <Button variant="outline" fullWidth onClick={fechar} disabled={busy}>Cancelar</Button>
                    <Button variant="danger" fullWidth loading={busy} onClick={enviar}>Enviar denúncia</Button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
