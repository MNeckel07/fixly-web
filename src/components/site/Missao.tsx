"use client";

import { useEffect, useRef } from "react";

/**
 * MISSÃO DADA → MISSÃO CUMPRIDA
 * =============================
 *
 * A única seção da página que precisa de JavaScript: a troca das duas cenas é
 * amarrada à ROLAGEM, não ao tempo. Quem sobe a página desfaz a troca; quem
 * para no meio vê o meio. Isso não existe em CSS puro sem `scroll-timeline`,
 * que ainda não é seguro em todos os navegadores que o Fixly atende.
 *
 * O QUE ESTÁ SINCRONIZADO
 *   cena A (mulher abrindo o pedido)  →  cena B (o aperto de mãos)
 *   "Missão dada."                    →  "É Missão cumprida, com a Fixly"
 *
 * ⚠️ AS DUAS CURVAS SÃO DIFERENTES DE PROPÓSITO. As fotos fazem crossfade no
 * meio (`t`, com suavização), mas o TEXTO sai antes e entra depois (`oa`/`ob`,
 * nas faixas 0–0.32 e 0.68–1). Se as duas usassem a mesma curva, por um
 * instante "Missão dada." ficaria legível por cima da foto do aperto de mãos —
 * a frase errada sobre a cena errada.
 *
 * ⚠️ O ESTADO INICIAL É O DA CENA A, escrito no próprio JSX (a cena B nasce com
 * `opacity: 0`). Sem isso, quem chega com a seção já na tela veria as duas
 * fotos sobrepostas até o primeiro evento de rolagem.
 */
export function Missao() {
  const secRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const sec = secRef.current;
    if (!sec) return;

    const grude = (seletor: string, opacidade: number, dy: number, escala: number) => {
      const el = sec.querySelector<HTMLElement>(seletor);
      if (!el) return;
      el.style.opacity = opacidade.toFixed(3);
      el.style.transformOrigin = "center bottom";
      el.style.transform = `translateY(${dy.toFixed(1)}px) scale(${escala.toFixed(4)})`;
    };

    const trava = (v: number) => Math.min(1, Math.max(0, v));

    const pinta = () => {
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      // progresso da travessia da seção pela tela: 0 ao entrar, 1 ao sair
      const prog = (vh - r.top) / (vh + r.height || 1);
      // a troca fica centrada em 0.5 — a primeira cena segura a primeira metade
      const bruto = trava((prog - 0.42) / 0.16);
      // smoothstep: entra e sai sem solavanco nas pontas
      const t = bruto * bruto * (3 - 2 * bruto);

      grude('[data-cena="a"]', 1 - t, 0, 1 + t * 0.04);
      grude('[data-cena="b"]', t, 0, 1.04 - t * 0.04);

      const oa = 1 - trava(bruto / 0.32);
      const ob = trava((bruto - 0.68) / 0.32);
      grude('[data-texto="a"]', oa, (1 - oa) * -26, 1);
      grude('[data-texto="b"]', ob, (1 - ob) * 26, 1);
    };

    // a rolagem dispara dezenas de vezes por segundo; o desenho acontece uma
    // vez por quadro, no requestAnimationFrame
    const aoRolar = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        pinta();
      });
    };

    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    pinta();
    // segunda passada depois das imagens assentarem: a altura da seção muda
    // quando os PNGs carregam, e com ela o cálculo do progresso
    const atrasado = setTimeout(pinta, 400);

    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      clearTimeout(atrasado);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section
      id="missao"
      ref={secRef}
      style={{
        position: "relative",
        background: "#fafafa",
        height: "min(88vh,780px,124vw)",
        minHeight: "min(560px,84vw)",
        zIndex: 2,
      }}
    >
      {/* fundo escuro em aclive: o topo sobe da esquerda para a direita, com o
          mesmo esfumado que fecha o hero */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0 76px,100% 0,100% 100%,0 100%)",
          background:
            "linear-gradient(to bottom,rgba(250,250,250,0.72) 0px,rgba(250,250,250,0.28) 14px,rgba(250,250,250,0) 34px),radial-gradient(120% 130% at 78% 8%,#3d3520 0%,#26292e 46%,#14171b 100%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", inset: 0 }}>
        <div data-cena="a" style={{ position: "absolute", inset: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cena-pedido-trim.webp"
            alt="Mulher abrindo um pedido de serviço no app Fixly"
            loading="lazy"
            style={{
              position: "absolute",
              left: "-11%",
              bottom: 0,
              /*
               * ⚠️ `maxWidth`, NUNCA `width`.
               *
               * O design escrevia `width: min(58%, 98% * 0.931)` — o `0.931` é
               * a proporção real do arquivo (845x908), a ideia sendo "largura =
               * altura × proporção". Só que as duas porcentagens têm BASES
               * DIFERENTES: a largura é % do contêiner na horizontal e o
               * `max-height` é % dele na vertical. Quando o `max-height` corta,
               * a largura fica cravada e a imagem ESTICA — medido em produção:
               * 844x730, proporção 1,157 contra 0,931 do original, 24% a mais
               * na horizontal.
               *
               * Com `max-width` + `max-height` e as duas dimensões em `auto`, o
               * navegador encolhe proporcionalmente até caber nos dois limites.
               */
              maxWidth: "min(58%,calc(98% * 0.931))",
              width: "auto",
              height: "auto",
              maxHeight: "98%",
              filter: "saturate(0.86) drop-shadow(0 40px 60px rgba(0,0,0,0.4))",
            }}
          />
        </div>

        <div data-cena="b" style={{ position: "absolute", inset: 0, opacity: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cena-aperto-trim.webp"
            alt="Cliente e profissional Fixly se cumprimentando depois do serviço"
            loading="lazy"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              /* mesma correção da cena A (aqui a proporção é 1378x910). */
              maxWidth: "min(52%,calc(88% * 1.514))",
              width: "auto",
              height: "auto",
              maxHeight: "88%",
              filter: "saturate(0.86) drop-shadow(0 40px 60px rgba(0,0,0,0.4))",
            }}
          />
        </div>

        {/* funde o pé da cena no fundo escuro da seção seguinte (o FAQ) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 110,
            zIndex: 1,
            background:
              "linear-gradient(to bottom,rgba(20,23,27,0) 0%,rgba(20,23,27,0.55) 46%,rgba(20,23,27,0.92) 78%,#14171b 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "0 5vw",
            pointerEvents: "none",
          }}
        >
          <p
            data-texto="a"
            style={{
              gridArea: "1/1",
              justifySelf: "end",
              textAlign: "right",
              margin: "0 clamp(0px,6vw,88px) 0 0",
              width: "min(88%,44ch)",
              maxWidth: "7ch",
              fontSize: "clamp(30px,8.4vw,132px)",
              lineHeight: 0.96,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#fff",
              textShadow: "0 18px 50px rgba(0,0,0,0.4)",
            }}
          >
            Missão dada.
          </p>
          <p
            data-texto="b"
            style={{
              gridArea: "1/1",
              justifySelf: "start",
              textAlign: "left",
              margin: 0,
              width: "min(92%,46%)",
              maxWidth: "none",
              fontSize: "clamp(26px,8.4vw,132px)",
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#fff",
              opacity: 0,
              textShadow: "0 18px 50px rgba(0,0,0,0.4)",
            }}
          >
            É Missão cumprida, com a{" "}
            <span
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontWeight: 700,
                fontSize: "1.18em",
                lineHeight: 0.8,
                color: "#ffc107",
                letterSpacing: 0,
                display: "inline-block",
                transform: "rotate(-3deg)",
                padding: "0 4px",
              }}
            >
              Fixly
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
