"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Revelação por rolagem — a ÚNICA função é hierarquia de leitura: o bloco entra
 * logo depois do título, então o olho lê na ordem em vez de receber a seção
 * inteira de uma vez.
 *
 * ⚠️ POR QUE ISTO NÃO USA `useState`
 * O estado visual vive em ATRIBUTOS DE DADO no elemento, escritos pelo efeito.
 * Duas razões:
 *   1. Zero re-render — o observador dispara uma vez e nada volta ao React.
 *   2. `data-reveal-visivel` é um atributo que o React NUNCA declara. Se o
 *      estado morasse em `className`, uma reconciliação do React poderia
 *      apagá-lo — é a mesma armadilha que faz o mapa do Leaflet sumir em branco
 *      quando se mexe no `className` do container dele.
 *
 * ⚠️ POR QUE O ESTADO INICIAL É ARMADO PELO JS
 * `data-reveal-armed` só aparece depois que o efeito confirma que vai observar.
 * Se o "invisível" viesse do servidor, uma falha de JS deixaria a página inteira
 * em branco e o buscador leria conteúdo escondido. Sem JS, tudo aparece.
 *
 * Quem pede menos movimento não recebe movimento nenhum: a checagem de
 * `prefers-reduced-motion` acontece antes de armar.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento || typeof IntersectionObserver === "undefined") return;

    el.dataset.revealArmed = "1";

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.revealVisivel = "1";
        obs.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
