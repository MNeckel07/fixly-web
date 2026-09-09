"use client";

import Link from "next/link";
import { useState } from "react";
import { PERGUNTAS } from "@/lib/faq";
import { links } from "@/lib/site";

/**
 * FAQ — acordeão, uma pergunta aberta por vez.
 *
 * A altura anima por `grid-template-rows: 0fr → 1fr`, e não por `max-height`
 * chutado: com o truque do grid a transição vai até a altura REAL do texto, sem
 * precisar adivinhar um valor grande o bastante (que sempre erra em algum
 * tamanho de tela e deixa a resposta cortada ou o cartão com folga sobrando).
 *
 * ⚠️ As perguntas vêm de `lib/faq.ts`, não escritas aqui, porque a MESMA lista
 * alimenta o JSON-LD `FAQPage` em `page.tsx`. Duplicar o texto criaria o
 * clássico dado estruturado que discorda da página visível — que o Google trata
 * como má-fé, não como descuido.
 */
export function Faq() {
  const [aberta, setAberta] = useState<number>(0);

  return (
    <section
      id="perguntas"
      style={{
        position: "relative",
        background: "linear-gradient(to bottom,#14171b 0%,#191d22 42%,#1f2429 100%)",
        color: "#fff",
        padding: "clamp(64px,8vw,104px) clamp(16px,4vw,32px) clamp(72px,8vw,112px)",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", maxWidth: 920, margin: "0 auto" }}>
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#ffc107",
          }}
        >
          Perguntas frequentes
        </p>
        <h2
          style={{
            margin: "18px 0 0",
            textAlign: "center",
            fontSize: "clamp(32px,4vw,52px)",
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          Pergunte antes de{" "}
          <span
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontWeight: 700,
              fontSize: "1.24em",
              lineHeight: 0.8,
              color: "#ffc107",
              letterSpacing: 0,
              display: "inline-block",
              transform: "rotate(-3deg)",
              padding: "0 4px",
            }}
          >
            contratar
          </span>
        </h2>

        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 14 }}>
          {PERGUNTAS.map((q, i) => {
            const on = aberta === i;
            return (
              <div
                key={q.p}
                className="fx-faq-card"
                style={{
                  position: "relative",
                  border: `1px solid ${on ? "rgba(255,193,7,0.55)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 18,
                  background: on ? "rgba(255,193,7,0.05)" : "rgba(255,255,255,0.03)",
                  overflow: "hidden",
                  transition: "border-color 260ms ease,background 260ms ease,transform 260ms ease",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: "linear-gradient(to bottom,#ffd45c,#ffc107)",
                    transform: on ? "scaleY(1)" : "scaleY(0)",
                    transformOrigin: "top",
                    transition: "transform 320ms cubic-bezier(0.2,0.8,0.2,1)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAberta(on ? -1 : i)}
                  aria-expanded={on}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    width: "100%",
                    padding: "clamp(20px,3vw,26px) clamp(18px,2.4vw,28px)",
                    border: 0,
                    background: "transparent",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "clamp(16px,1.6vw,20px)",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.35,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      flex: "0 0 auto",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.35)",
                      width: 24,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{q.p}</span>
                  <span
                    style={{
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: `1px solid ${on ? "rgba(255,193,7,0.5)" : "rgba(255,255,255,0.2)"}`,
                      background: on ? "rgba(255,193,7,0.16)" : "transparent",
                      color: "#ffc107",
                      transform: on ? "rotate(135deg)" : "rotate(0deg)",
                      transition:
                        "transform 340ms cubic-bezier(0.2,0.8,0.2,1),background 260ms ease,border-color 260ms ease",
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                </button>

                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: on ? "1fr" : "0fr",
                    transition: "grid-template-rows 380ms cubic-bezier(0.2,0.8,0.2,1)",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <p
                      style={{
                        margin: 0,
                        padding: "0 clamp(20px,7vw,84px) 28px clamp(18px,6vw,72px)",
                        fontSize: "clamp(13.5px,1.5vw,15px)",
                        lineHeight: 1.75,
                        color: "rgba(255,255,255,0.66)",
                        opacity: on ? 1 : 0,
                        transform: on ? "translateY(0)" : "translateY(6px)",
                        transition: "opacity 300ms ease 60ms,transform 300ms ease 60ms",
                      }}
                    >
                      {q.r}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
            Ficou outra dúvida?
          </p>
          <Link
            href={links.cadastroContratante}
            className="fx-faq-cta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 28px",
              borderRadius: 999,
              background: "#ffc107",
              color: "#1f2329",
              fontSize: 15,
              fontWeight: 700,
              transition: "background 200ms ease,transform 200ms ease",
            }}
          >
            Cadastre-se e pergunte
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* brilho âmbar atrás do título */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 438,
            top: -133,
            width: 900,
            height: 420,
            transform: "translateX(-50%)",
            background:
              "radial-gradient(50% 50% at 50% 50%,rgba(255,193,7,0.16),rgba(255,193,7,0) 70%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </section>
  );
}
