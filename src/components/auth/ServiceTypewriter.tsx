"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

/**
 * Efeito "máquina de escrever": digita e apaga, um serviço por vez, com cursor
 * piscando — passando por TODAS as categorias cadastradas (recebidas por prop).
 * Implementação própria (sem biblioteca): um estado + timeouts encadeados.
 * Alternativas de mercado seriam Typed.js ou react-type-animation; optei por
 * não adicionar dependência — controle total do cursor/marca e CSP-safe.
 */
export function ServiceTypewriter({ services }: { services: string[] }) {
  // memoizado: sem isso o array literal do fallback é novo a cada render e
  // reinicia o efeito (a digitação ficava travando)
  const list = useMemo(
    () => (services.length ? services : ["Eletricista", "Encanador", "Diarista", "Pintor"]),
    [services],
  );
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  useEffect(() => {
    const full = list[idx % list.length];
    let t: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < full.length) {
        // velocidade levemente irregular = mais "humano"
        t = setTimeout(() => setText(full.slice(0, text.length + 1)), 60 + Math.random() * 55);
      } else {
        t = setTimeout(() => setPhase("pausing"), 1500);
      }
    } else if (phase === "pausing") {
      t = setTimeout(() => setPhase("deleting"), 250);
    } else {
      if (text.length > 0) {
        t = setTimeout(() => setText(full.slice(0, text.length - 1)), 32);
      } else {
        t = setTimeout(() => {
          setIdx((i) => (i + 1) % list.length);
          setPhase("typing");
        }, 180);
      }
    }
    return () => clearTimeout(t);
  }, [text, phase, idx, list]);

  const idle = phase === "pausing"; // cursor pisca parado, fica sólido enquanto digita

  return (
    // ocupa a mesma largura do título/parágrafo acima (max-w-xl), como uma
    // barra de busca de verdade — em vez da pílula pequena de antes
    <span className="flex w-full max-w-xl items-center gap-3 rounded-2xl bg-white/10 border border-white/15 px-5 h-16 text-white">
      <Search className="h-6 w-6 text-primary shrink-0" strokeWidth={2} />
      <span className="text-2xl font-medium whitespace-nowrap leading-none truncate">
        {text}
        <span
          className={`inline-block w-[3px] h-[1.05em] translate-y-[3px] ml-[4px] bg-primary ${idle ? "animate-cursor-blink" : ""}`}
          aria-hidden
        />
      </span>
      {/* acessível a leitores de tela: a lista completa de serviços */}
      <span className="sr-only">Serviços disponíveis: {list.join(", ")}.</span>
    </span>
  );
}
