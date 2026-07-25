"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Efeito "máquina de escrever": digita e apaga, um serviço por vez, com cursor
 * piscando — passando por TODAS as categorias cadastradas (recebidas por prop).
 * Implementação própria (sem biblioteca): um estado + timeouts encadeados.
 * Alternativas de mercado seriam Typed.js ou react-type-animation; optei por
 * não adicionar dependência — controle total do cursor/marca e CSP-safe.
 */
export function ServiceTypewriter({ services }: { services: string[] }) {
  const list = services.length ? services : ["Eletricista", "Encanador", "Diarista", "Pintor"];
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
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 h-10 min-w-[150px] text-white">
      <Search className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
      <span className="text-[15px] font-medium whitespace-nowrap leading-none">
        {text}
        <span
          className={`inline-block w-[2px] h-[1.05em] translate-y-[2px] ml-[3px] bg-primary ${idle ? "animate-cursor-blink" : ""}`}
          aria-hidden
        />
      </span>
      {/* acessível a leitores de tela: a lista completa de serviços */}
      <span className="sr-only">Serviços disponíveis: {list.join(", ")}.</span>
    </span>
  );
}
