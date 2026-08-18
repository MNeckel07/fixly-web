"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  PIX_KEY_TYPES,
  maskPixKey,
  validatePixKey,
  guessPixKeyType,
  onlyDigits,
  type PixKeyType,
} from "@/lib/format";

/**
 * Configuração da chave PIX em duas perguntas: **qual o tipo** e **qual a
 * chave**. A formatação vem do tipo — CPF ganha pontos, celular ganha
 * parênteses, aleatória fica minúscula com traços.
 *
 * Por que não deixar um campo solto: é para lá que vai o dinheiro do saque, e
 * a produção já tem lixo salvo ("321231", "xz\\x") justamente porque o campo
 * aceitava qualquer coisa.
 *
 * O que é gravado: CPF/CNPJ/celular vão **só com dígitos** (é assim que o banco
 * e o Mercado Pago esperam); e-mail e aleatória vão como o usuário digitou.
 */
export function PixKeyDialog({
  valorAtual,
  onSalvar,
}: {
  valorAtual: string;
  onSalvar: (chave: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<PixKeyType>(() => guessPixKeyType(valorAtual));
  const [valor, setValor] = useState(() => (valorAtual ? maskPixKey(valorAtual, guessPixKeyType(valorAtual)) : ""));
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const escolhido = PIX_KEY_TYPES.find((t) => t.id === tipo)!;

  function trocarTipo(novo: PixKeyType) {
    setTipo(novo);
    setErro("");
    // o que estava digitado raramente serve para o outro tipo
    setValor("");
  }

  async function salvar() {
    const problema = validatePixKey(valor, tipo);
    if (problema) return setErro(problema);

    // e-mail e aleatória vão inteiros; documento e telefone, só dígitos
    const paraSalvar = tipo === "email" || tipo === "aleatoria" ? valor.trim() : onlyDigits(valor);

    setBusy(true);
    setErro("");
    const res = await onSalvar(paraSalvar);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível salvar.");
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-black/10 text-xs font-semibold text-ink hover:bg-black/[0.03] transition"
      >
        <KeyRound className="h-3.5 w-3.5" /> Configurar
      </button>

      {aberto && montado &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={() => setAberto(false)} />
            <div className="relative w-full max-w-md translate-y-6 rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(31,35,41,0.4)] animate-fade-up">
              <h3 className="text-lg font-bold text-ink">Configurar chave PIX</h3>
              <p className="mt-1.5 text-sm text-gray">
                É para esta chave que vai o dinheiro dos seus saques. Ela precisa estar no
                <b> seu nome</b>, no mesmo CPF do cadastro.
              </p>

              <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-light">
                Qual é o tipo da chave?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PIX_KEY_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => trocarTipo(t.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      tipo === t.id ? "border-primary bg-primary/10" : "border-black/10 hover:bg-black/[0.02]"
                    }`}
                  >
                    <span className="block text-sm font-medium text-ink">{t.label}</span>
                    <span className="block text-[11px] text-gray-light leading-tight mt-0.5">{t.hint}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium text-ink">Digite a chave</label>
                <Input
                  value={valor}
                  onChange={(e) => setValor(maskPixKey(e.target.value, tipo))}
                  placeholder={escolhido.placeholder}
                  inputMode={tipo === "email" || tipo === "aleatoria" ? "text" : "numeric"}
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-gray-light">
                  {tipo === "aleatoria"
                    ? "Copie do app do seu banco, em Pix → Minhas chaves."
                    : "Formatamos sozinho enquanto você digita."}
                </p>
              </div>

              {erro && <p className="mt-3 text-sm text-danger">{erro}</p>}

              <div className="mt-5 flex gap-2">
                <Button variant="outline" fullWidth onClick={() => setAberto(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button fullWidth loading={busy} onClick={salvar}>
                  <Check className="h-4 w-4" /> Salvar chave
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
