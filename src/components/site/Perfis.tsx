import Link from "next/link";
import type { CSSProperties } from "react";
import { links } from "@/lib/site";

/**
 * ESCOLHA O SEU LADO — os dois cartões escuros que separam profissional de
 * contratante. É onde a landing deixa de ser uma página só e vira duas portas.
 *
 * ⚠️ A TROCA DE FOTO É CSS, NÃO JAVASCRIPT.
 * No arquivo do design ela era feita por listeners de `pointerenter`; aqui vive
 * em `globals-site.css`, sob `.fx-lado:hover`. Isso vale um componente de
 * servidor a menos, funciona antes da hidratação e some sozinho abaixo de
 * 900px, onde o cartão empilha e o trio nem é mostrado.
 *
 * (De quebra, a versão em JS tinha um defeito: o timer de rodízio no toque
 * usava uma variável `i` que não existia naquele escopo, e teria estourado.)
 *
 * A pessoa sozinha fica FORA do `data-clip`, e é isso que deixa a cabeça dela
 * passar por cima da borda do cartão. O trio fica DENTRO, com
 * `clip-path: inset(-70px 0 0 0 round 24px)`: sobra do topo, cortado nos lados.
 */
type Lado = {
  chave: "pro" | "cli";
  href: string;
  fotoUma: string;
  fotoTres: string;
  titulo: string;
  texto: string;
  chamada: string;
};

const LADOS: Lado[] = [
  {
    chave: "pro",
    href: links.cadastroPrestador,
    fotoUma: "/pro-um-busto.webp",
    fotoTres: "/pro-tres-busto.webp",
    titulo: "Mostre o seu trabalho",
    texto: "Receba pedidos de quem precisa hoje, no seu bairro.",
    chamada: "Trabalhar com a Fixly",
  },
  {
    chave: "cli",
    href: links.cadastroContratante,
    fotoUma: "/cliente-uma-busto.webp",
    fotoTres: "/cliente-tres-busto.webp",
    titulo: "Contrate o trabalho de alguém",
    texto: "Descreva uma vez, receba propostas de profissionais conferidos.",
    chamada: "Quero receber propostas",
  },
];

function Seta({ tamanho = 15 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Cartao({ lado }: { lado: Lado }) {
  return (
    <Link
      data-lado={lado.chave}
      href={lado.href}
      className="fx-lado"
      style={
        {
          "--card-h": "clamp(200px,21vw,250px)",
          "--fig": "calc((var(--card-h) + 44px) * 0.71)",
          position: "relative",
          display: "block",
          height: "var(--card-h)",
          marginTop: "clamp(56px,7vw,76px)",
          transition: "transform 320ms cubic-bezier(0.2,0.8,0.2,1)",
        } as CSSProperties
      }
    >
      <div
        aria-hidden="true"
        data-casca="1"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          background: "linear-gradient(160deg,#23262b 0%,#1b1e23 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          transition: "box-shadow 320ms ease,border-color 320ms ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-30%",
            top: "-30%",
            width: "80%",
            height: "80%",
            borderRadius: "50%",
            background:
              "radial-gradient(50% 50% at 50% 50%,rgba(255,193,7,0.18),rgba(255,193,7,0) 70%)",
          }}
        />
      </div>

      {/* o trio: dentro do cartão, aparece no hover */}
      <div
        data-clip="1"
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "inset(-70px 0 0 0 round 24px)",
          pointerEvents: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-foto="tres"
          src={lado.fotoTres}
          alt=""
          loading="lazy"
          style={{
            position: "absolute",
            left: "50%",
            top: -44,
            height: "calc(var(--card-h) + 44px)",
            width: "auto",
            maxWidth: "none",
            opacity: 0,
            transform: "translate(-50%,10px)",
            filter: "drop-shadow(0 26px 40px rgba(0,0,0,0.45))",
            transition: "opacity 380ms ease,transform 480ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
        />
      </div>

      {/* a pessoa sozinha: a cabeça passa por cima da borda do cartão */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-foto="uma"
        src={lado.fotoUma}
        alt=""
        loading="lazy"
        style={{
          position: "absolute",
          right: "2%",
          bottom: 0,
          height: "calc(var(--card-h) + 44px)",
          width: "auto",
          filter: "drop-shadow(0 26px 40px rgba(0,0,0,0.4))",
          transition: "opacity 380ms ease,transform 480ms cubic-bezier(0.2,0.8,0.2,1)",
          pointerEvents: "none",
        }}
      />

      <div
        data-copy="1"
        style={{
          position: "relative",
          zIndex: 1,
          width: "calc(100% - var(--fig) - 14px)",
          padding: "clamp(18px,3vw,26px) 14px clamp(20px,3vw,28px)",
          overflow: "hidden",
          transition: "opacity 300ms ease,transform 380ms ease",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "clamp(19px,2.1vw,30px)",
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {lado.titulo}
        </h3>
        <p
          style={{
            margin: "clamp(10px,1.6vw,16px) 0 0",
            fontSize: "clamp(12.5px,1.4vw,13.5px)",
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {lado.texto}
        </p>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            marginTop: 18,
            fontSize: 13,
            fontWeight: 700,
            color: "#ffc107",
          }}
        >
          {lado.chamada}
          <Seta />
        </span>
      </div>

      <span
        data-hovercta="1"
        style={{
          position: "absolute",
          left: 26,
          bottom: 26,
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "13px 24px",
          borderRadius: 999,
          background: "#ffc107",
          color: "#1f2329",
          fontSize: 13.5,
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 18px 34px -14px rgba(0,0,0,0.7)",
          opacity: 0,
          transform: "translateY(12px)",
          transition: "opacity 320ms ease,transform 420ms cubic-bezier(0.2,0.8,0.2,1)",
          pointerEvents: "none",
        }}
      >
        Cadastrar-me
        <Seta />
      </span>
    </Link>
  );
}

export function Perfis() {
  return (
    <section
      id="lados"
      style={{
        position: "relative",
        background: "#fafafa",
        padding: "20px clamp(16px,4vw,32px) clamp(64px,8vw,110px)",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <h2
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: "clamp(28px,3.4vw,42px)",
            lineHeight: 1.15,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "#1f2329",
          }}
        >
          Escolha o que você precisa{" "}
          <span
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontWeight: 700,
              fontSize: "1.26em",
              lineHeight: 0.8,
              color: "#7a5600",
              letterSpacing: 0,
              display: "inline-block",
              transform: "rotate(-3deg)",
              padding: "0 4px",
            }}
          >
            hoje
          </span>
        </h2>
        <p
          style={{
            margin: "14px auto 0",
            maxWidth: 520,
            textAlign: "center",
            fontSize: 15,
            lineHeight: 1.65,
            color: "#565d66",
          }}
        >
          Mostrar o seu trabalho ou contratar o trabalho de alguém.
        </p>

        <div
          data-lados-grid="1"
          style={{
            marginTop: "clamp(20px,3vw,30px)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          {LADOS.map((l) => (
            <Cartao key={l.chave} lado={l} />
          ))}
        </div>
      </div>
    </section>
  );
}
