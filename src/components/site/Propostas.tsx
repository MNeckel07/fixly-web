import Link from "next/link";
import { links, CTA_LABEL } from "@/lib/site";

/**
 * PROPOSTAS — o argumento que derruba a maior objeção ("vou ter que pechinchar
 * com cada um?"), com o celular apoiado numa mancha âmbar.
 *
 * A mancha é desenhada por baixo do PNG e girada; a segunda, branca e
 * translúcida, é só o brilho. Nenhuma das duas é imagem — border-radius de oito
 * valores resolve, e não custa requisição nenhuma.
 */
export function Propostas() {
  return (
    <section
      id="propostas"
      style={{
        position: "relative",
        background: "#fafafa",
        overflow: "hidden",
        padding: "clamp(24px,4vw,10px) clamp(16px,4vw,32px) 40px",
      }}
    >
      <div
        data-prop-grid="1"
        style={{
          position: "relative",
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: "clamp(28px,4vw,48px)",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            data-prop-titulo="1"
            style={{
              margin: 0,
              fontSize: "clamp(28px,3.8vw,42px)",
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#1f2329",
              maxWidth: "15ch",
            }}
          >
            Receba propostas e negocie até fechar
          </h2>
          <p
            style={{
              margin: "22px 0 0",
              maxWidth: 460,
              fontSize: "clamp(14px,1.6vw,17px)",
              lineHeight: 1.7,
              color: "#565d66",
            }}
          >
            Cada profissional envia o preço e o prazo dele. Achou caro? Mande uma contraproposta. O
            valor só sai da sua conta quando você aceitar, e fica retido até aprovar o serviço.
          </p>
          <Link
            href={links.cadastroContratante}
            className="fx-btn-amarelo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: 34,
              padding: "13px 28px",
              borderRadius: 999,
              background: "#ffc107",
              color: "#1f2329",
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 14px 30px -12px rgba(255,193,7,0.7)",
            }}
          >
            {CTA_LABEL}
          </Link>
        </div>

        <div data-prop-fone="1" style={{ position: "relative" }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: "16%",
              width: "100%",
              height: "66%",
              borderRadius: "38% 62% 58% 42% / 44% 40% 60% 56%",
              background: "linear-gradient(150deg,#ffd24d 0%,#ffc107 50%,#e8ad00 100%)",
              transform: "rotate(-6deg)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "14%",
              top: "30%",
              width: "72%",
              height: "40%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              transform: "rotate(10deg)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phone-propostas.webp"
            alt="Tela de propostas recebidas do app Fixly"
            loading="lazy"
            style={{
              position: "relative",
              display: "block",
              width: "100%",
              height: "auto",
              willChange: "transform",
              animation: "fx-float 7s ease-in-out 0.8s infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
