import Link from "next/link";
import { Header } from "@/components/site/Header";
import { links, CTA_LABEL } from "@/lib/site";

/**
 * HERO — o fundo escuro é um retângulo INCLINADO, não um gradiente com curva.
 *
 * `skewY(4deg)` num bloco que sangra 90px para fora dos dois lados: é isso que
 * dá a diagonal reta na base. Por isso ele tem `left/right: -90px` — sem a
 * sangria, o canto girado deixaria triângulos de fundo claro aparecendo.
 *
 * A segunda camada por cima é o esfumado: dissolve os últimos 30px do escuro no
 * `#fafafa` da página, para a diagonal não terminar num corte seco.
 */

/* ────────────────────────── órbitas ──────────────────────────
 * Dois anéis pontilhados em volta dos celulares. Cada anel é dividido ao meio:
 * a metade de cima fica ATRÁS dos aparelhos e a de baixo NA FRENTE — é esse
 * corte que dá a sensação de os celulares estarem dentro da órbita, e não
 * colados sobre um desenho.
 *
 * As contas ficam aqui, em código, em vez de coordenadas digitadas à mão: o
 * ponto de cada bolinha depende do seno e do cosseno do ângulo NA ELIPSE já
 * rotacionada. Number colado seria impossível de conferir e de ajustar.
 */
type Orbita = { cx: number; cy: number; rx: number; ry: number; rot: number };

const ORB1: Orbita = { cx: 280, cy: 370, rx: 400, ry: 170, rot: -18 };
const ORB2: Orbita = { cx: 300, cy: 420, rx: 340, ry: 120, rot: -8 };

/** Meio arco da elipse: "atras" é a metade de cima, "frente" a de baixo. */
function arco(o: Orbita, metade: "atras" | "frente") {
  return metade === "atras"
    ? `M ${o.cx - o.rx} ${o.cy} A ${o.rx} ${o.ry} 0 0 1 ${o.cx + o.rx} ${o.cy}`
    : `M ${o.cx + o.rx} ${o.cy} A ${o.rx} ${o.ry} 0 0 1 ${o.cx - o.rx} ${o.cy}`;
}

/** Ponto sobre a elipse no ângulo dado, já levando em conta a rotação dela. */
function ponto(o: Orbita, angulo: number) {
  const t = (angulo * Math.PI) / 180;
  const ro = (o.rot * Math.PI) / 180;
  const x = o.rx * Math.cos(t);
  const y = o.ry * Math.sin(t);
  return {
    cx: o.cx + x * Math.cos(ro) - y * Math.sin(ro),
    cy: o.cy + x * Math.sin(ro) + y * Math.cos(ro),
  };
}

function Orbitas({ camada }: { camada: "atras" | "frente" }) {
  const p1 = ponto(ORB1, camada === "atras" ? 250 : 100);
  const p2 = ponto(ORB2, 60);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 560 720"
      preserveAspectRatio="none"
      fill="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: camada === "atras" ? 0 : 2,
      }}
    >
      <path
        d={arco(ORB1, camada)}
        transform={`rotate(${ORB1.rot} ${ORB1.cx} ${ORB1.cy})`}
        stroke={camada === "atras" ? "rgba(255,193,7,0.45)" : "rgba(255,193,7,0.7)"}
        strokeWidth={2.6}
        strokeDasharray="7 9"
        strokeLinecap="round"
        style={{ animation: "fx-dash 3.2s linear infinite" }}
      />
      <path
        d={arco(ORB2, camada)}
        transform={`rotate(${ORB2.rot} ${ORB2.cx} ${ORB2.cy})`}
        stroke={camada === "atras" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.35)"}
        strokeWidth={2.6}
        strokeDasharray="5 9"
        strokeLinecap="round"
        style={{ animation: "fx-dash 4.1s linear infinite" }}
      />
      <circle cx={p1.cx} cy={p1.cy} r={camada === "atras" ? 4 : 4.5} fill="#ffc107" />
      {camada === "frente" && <circle cx={p2.cx} cy={p2.cy} r={3.5} fill="rgba(255,255,255,0.8)" />}
    </svg>
  );
}

export function Hero() {
  return (
    <section style={{ position: "relative", zIndex: 2, color: "#fff" }}>
      {/* fundo escuro inclinado */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -90,
          right: -90,
          top: -160,
          bottom: 46,
          transform: "skewY(4deg)",
          background:
            "radial-gradient(110% 85% at 78% 12%, #6b5410 0%, #3d3520 34%, #23262b 66%, #1a1d21 100%)",
          pointerEvents: "none",
        }}
      />
      {/* esfumado da base + brilho âmbar no canto inferior esquerdo */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -90,
          right: -90,
          top: -160,
          bottom: 46,
          transform: "skewY(4deg)",
          background:
            "linear-gradient(to bottom,rgba(250,250,250,0) calc(100% - 30px),rgba(250,250,250,0.18) calc(100% - 19px),rgba(250,250,250,0.66) calc(100% - 8px),#fafafa 100%),radial-gradient(55% 42% at 12% 88%, rgba(255,193,7,0.16), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <Header />

      <div
        id="topo"
        data-hero-grid="1"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))",
          gap: "clamp(16px,3vw,24px)",
          alignItems: "start",
        }}
      >
        <div style={{ paddingTop: "clamp(8px,4vw,56px)" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px,5.4vw,58px)",
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              maxWidth: "14ch",
              textWrap: "balance",
              color: "#fff",
            }}
          >
            Conserte sua casa sem{" "}
            <span
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontWeight: 700,
                fontSize: "1.28em",
                lineHeight: 0.8,
                color: "#ffc107",
                letterSpacing: 0,
                display: "inline-block",
                transform: "rotate(-3deg)",
                padding: "0 4px",
              }}
            >
              apostar
            </span>{" "}
            em quem vai aparecer.
          </h1>

          <p
            data-hero-sub="1"
            style={{
              margin: "clamp(16px,2.4vw,26px) 0 0",
              maxWidth: 520,
              fontSize: "clamp(14px,1.5vw,16px)",
              lineHeight: 1.65,
              fontWeight: 400,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            Eletricista, encanador, pintor e mais. Cada profissional passou por conferência de
            documentos, e o seu dinheiro só é liberado depois que você aprovar o serviço.
          </p>

          <div
            style={{
              marginTop: "clamp(22px,3vw,38px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={links.cadastroContratante}
              className="fx-btn-amarelo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 26px",
                borderRadius: 999,
                background: "#ffc107",
                color: "#1f2329",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {CTA_LABEL}
            </Link>
            <Link
              href={links.cadastroContratante}
              aria-label="Começar"
              className="fx-btn-fantasma"
              style={{
                display: "grid",
                placeItems: "center",
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.5)",
                color: "#fff",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </Link>
          </div>
        </div>

        <div
          data-hero-fones="1"
          style={{
            position: "relative",
            aspectRatio: "560/720",
            minWidth: 0,
            zIndex: 3,
            marginBottom: "-6vw",
          }}
        >
          <Orbitas camada="atras" />

          <p
            data-anota="1"
            style={{
              position: "absolute",
              right: "6%",
              top: "5%",
              margin: 0,
              width: "30%",
              maxWidth: 180,
              fontSize: "clamp(11px,1.15vw,12.5px)",
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.75)",
              textAlign: "left",
            }}
          >
            Cadastre-se e receba propostas de profissionais conferidos na sua região.
          </p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phone-categorias-1200.webp"
            alt="Tela de categorias do app Fixly"
            fetchPriority="high"
            style={{
              position: "absolute",
              zIndex: 1,
              left: "-12%",
              top: 0,
              width: "94%",
              height: "auto",
              willChange: "transform",
              animation: "fx-float 7s ease-in-out infinite",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phone-home-1200.webp"
            alt="Tela inicial do app Fixly"
            fetchPriority="high"
            style={{
              position: "absolute",
              zIndex: 1,
              right: "-14%",
              top: "30%",
              width: "94%",
              height: "auto",
              willChange: "transform",
              animation: "fx-float 7s ease-in-out 1.6s infinite",
            }}
          />

          <Orbitas camada="frente" />
        </div>
      </div>
    </section>
  );
}
