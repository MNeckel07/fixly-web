"use client";

import { useState } from "react";
import { Check, Lock, RotateCcw, User, Wallet } from "lucide-react";

/**
 * ELEMENTO ASSINATURA — A TRILHA DO ESCROW
 * ========================================
 *
 * Esta é a única ousadia da página, e ela é gasto deliberado: em vez de LER que
 * o dinheiro fica retido, o visitante APERTA "Aprovar o serviço" e vê a ficha
 * andar. O mecanismo vira gesto. É a coisa mais difícil de explicar do produto
 * e a mais fácil de entender quando você a executa uma vez.
 *
 * ⚠️ HONESTIDADE NOS VALORES: a ficha entra com R$ 200 (o valor do serviço, que
 * é o que fica retido) e sai com R$ 170 — porque é isso que o profissional
 * recebe de fato depois da comissão. Mostrar R$ 200 chegando na mão dele seria
 * mentira, e a tabela da seção "quanto custa" desmentiria três telas abaixo.
 * Os dois números batem com `PLATFORM_FEE_RATE = 0.15` do produto.
 *
 * Movimento e `prefers-reduced-motion`: quem pede menos movimento continua
 * recebendo a MUDANÇA DE ESTADO (a informação), só não recebe o deslize — a
 * transição é desligada no CSS, não o componente.
 */

type Estado = "retido" | "liberado";

export function Escrow() {
  const [estado, setEstado] = useState<Estado>("retido");
  const liberado = estado === "liberado";

  return (
    <section id="seguranca" className="bg-tinta py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="max-w-3xl">
          <p className="mb-4 font-mono text-[11.5px] font-medium tracking-[0.14em] text-amarelo uppercase">
            O dinheiro
          </p>
          <h2 className="text-[clamp(1.85rem,4.4vw,2.9rem)] font-extrabold text-white">
            Ele só recebe depois que você aprovar.
          </h2>
          <p className="mt-5 text-[16.5px] leading-relaxed text-zinco">
            Quando você fecha, o valor sai da sua conta mas não vai para o
            profissional. Fica retido na Fixly. Ele trabalha sabendo que o
            dinheiro já existe, e você acompanha sabendo que ele ainda não é
            dele.
          </p>
        </header>

        {/* ── a trilha ── */}
        <div className="mt-14 rounded-2xl border border-white/12 bg-white/[0.04] p-6 sm:p-10">
          {/*
            ⚠️ A FICHA PRECISA DE FOLGA NAS DUAS PONTAS.
            Ela é posicionada em `left: 100%` com `-translate-x-1/2`, então
            METADE dela fica FORA do trilho quando o valor é liberado. Sem este
            respiro lateral ela encosta na borda do painel e parece cortada —
            defeito que só aparece no pixel, não no código.
          */}
          <div className="px-12 sm:px-16">
            {/*
              Grade de 3 colunas, não `justify-between`: com larguras diferentes
              o `between` deixaria o rótulo do meio fora do marco de 50%. Cada
              coluna ocupa um terço, então o centro do rótulo do meio cai
              exatamente sobre o marco.
            */}
            <div className="mb-7 grid grid-cols-3 items-end gap-2 font-mono text-[10.5px] tracking-[0.12em] uppercase">
              <span className="flex items-center gap-1.5 text-zinco">
                <User className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                Você
              </span>
              <span
                className={`flex items-center justify-center gap-1.5 text-center transition-colors duration-300 ${
                  liberado ? "text-white/35" : "text-amarelo"
                }`}
              >
                <Lock className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                Retido na Fixly
              </span>
              <span
                className={`flex items-center justify-end gap-1.5 transition-colors duration-300 ${
                  liberado ? "text-verde" : "text-white/35"
                }`}
              >
                <Wallet className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                Profissional
              </span>
            </div>

            {/* trilho */}
            <div className="relative h-1.5" aria-hidden="true">
              <div className="absolute inset-0 rounded-full bg-white/12" />
              <div
                className={`trilho-preenchido absolute inset-y-0 left-0 rounded-full ${
                  liberado ? "bg-verde" : "bg-amarelo"
                }`}
                style={{ width: liberado ? "100%" : "50%" }}
              />

              {/* marcos */}
              {[0, 50, 100].map((p) => (
                <span
                  key={p}
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tinta ring-2 ring-white/25"
                  style={{ left: `${p}%` }}
                />
              ))}

              {/* a ficha que anda */}
              <div
                className={`ficha-escrow absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3.5 py-2 font-mono text-[14px] font-medium whitespace-nowrap shadow-lg ${
                  liberado
                    ? "border-verde bg-verde text-white"
                    : "border-amarelo bg-amarelo text-tinta"
                }`}
                style={{ left: liberado ? "100%" : "50%" }}
              >
                {liberado ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                    R$ 170,00
                  </span>
                ) : (
                  "R$ 200,00"
                )}
              </div>
            </div>
          </div>

          {/* ── estado em texto + o gesto ── */}
          <div className="mt-16 flex flex-col gap-6 border-t border-white/12 pt-8 sm:flex-row sm:items-start sm:justify-between">
            <p
              aria-live="polite"
              className="max-w-md text-[15.5px] leading-relaxed text-zinco"
            >
              {liberado ? (
                <>
                  <strong className="font-semibold text-white">Liberado.</strong>{" "}
                  No dia seguinte ele pode sacar. Dos R$ 200 do serviço, R$ 30
                  ficaram com a Fixly. É a taxa de 15%, cobrada só porque o
                  serviço aconteceu.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-white">
                    O dinheiro está parado aqui.
                  </strong>{" "}
                  O serviço terminou e o profissional marcou como concluído. Nada
                  se move até você olhar e aprovar.
                </>
              )}
            </p>

            {liberado ? (
              <button
                type="button"
                onClick={() => setEstado("retido")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-[15px] font-medium text-zinco transition-colors hover:border-white/40 hover:text-white"
              >
                <RotateCcw className="size-4" strokeWidth={2.25} aria-hidden="true" />
                Ver de novo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEstado("liberado")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amarelo px-6 py-3.5 text-[15.5px] font-semibold text-tinta shadow-placa transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#ffca2b] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <Check className="size-4.5" strokeWidth={2.75} aria-hidden="true" />
                Aprovar o serviço
              </button>
            )}
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-[14.5px] leading-relaxed text-white/55">
          Se você esquecer, o sistema não deixa o profissional no prejuízo: no
          quinto dia você recebe um aviso por e-mail, e no sétimo o valor é
          liberado sozinho. Se algo estiver errado, esses dois dias são seus para
          reclamar.
        </p>
      </div>
    </section>
  );
}
