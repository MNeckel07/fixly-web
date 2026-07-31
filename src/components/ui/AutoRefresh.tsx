"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a tela sozinha, sem F5.
 *
 * Usa `router.refresh()`: o Next busca os Server Components de novo e faz o
 * merge, então o estado do cliente (o que está digitado, modal aberto, chat
 * rolado) NÃO se perde — diferente de recarregar a página.
 *
 * Só roda com a aba visível, para não ficar consultando o banco à toa quando
 * o telefone está no bolso; e revalida na hora em que a aba volta ao foco.
 */
export function AutoRefresh({
  seconds = 15,
  /** Pausa (ex.: enquanto um formulário está sendo enviado). */
  paused = false,
}: {
  seconds?: number;
  paused?: boolean;
}) {
  const router = useRouter();
  // ref para o intervalo ler o valor atual sem se reagendar a cada render
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      router.refresh();
    };

    const timer = setInterval(tick, Math.max(5, seconds) * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, seconds]);

  return null;
}
