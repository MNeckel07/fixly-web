/**
 * PASSO A PASSO — quatro cartões sobre as manchas âmbar.
 *
 * As três manchas de fundo (âmbar, creme e cinza) são `border-radius` de oito
 * valores girado: é o jeito de fazer uma forma orgânica sem SVG e sem imagem.
 * A cinza tem `data-blob-cinza` porque some abaixo de 900px — empilhado, ela
 * cairia atrás do texto e sujaria a leitura.
 *
 * Os cartões alternam `translateY(0)` e `translateY(28px)` para o bloco não
 * ficar um tabuleiro perfeito. A ordem 01→04 é informação de verdade aqui: é a
 * sequência que o pedido percorre, então numerar é honesto.
 */
type Passo = {
  num: string;
  desloca: string;
  titulo: string;
  texto: string;
  paths: string[];
};

const PASSOS: Passo[] = [
  {
    num: "01",
    desloca: "0px",
    titulo: "Descreva o serviço",
    texto:
      "Escolha a categoria, escreva o que precisa e envie fotos. Uma foto explica mais que três parágrafos.",
    paths: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M10 13h4", "M8 17h8"],
  },
  {
    num: "02",
    desloca: "28px",
    titulo: "Vários profissionais recebem",
    texto:
      "Quem atende a sua categoria na sua região recebe o pedido na hora. Você não liga para ninguém.",
    paths: [
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
      "M22 21v-2a4 4 0 0 0-3-3.87",
      "M16 3.13a4 4 0 0 1 0 7.75",
    ],
  },
  {
    num: "03",
    desloca: "0px",
    titulo: "As propostas chegam",
    texto: "Cada um envia preço e prazo. Achou caro? Faça uma contraproposta até fechar.",
    paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M8 9h8", "M8 13h5"],
  },
  {
    num: "04",
    desloca: "28px",
    titulo: "Aprove e libere o pagamento",
    texto:
      "O valor fica retido na Fixly. Só vai para o profissional quando você aprovar o serviço.",
    paths: [
      "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z",
      "M7 11V7a5 5 0 0 1 10 0v4",
      "m9.5 16.5 2 2 3.5-3.5",
    ],
  },
];

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      style={{
        position: "relative",
        background: "#fafafa",
        padding: "clamp(24px,3vw,34px) clamp(16px,4vw,32px) clamp(70px,9vw,120px)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -120,
          top: 96,
          width: 760,
          height: 520,
          borderRadius: "44% 56% 52% 48% / 52% 44% 56% 48%",
          background: "linear-gradient(140deg,#ffd24d 0%,#ffc107 45%,#f0b400 100%)",
          opacity: 0.92,
          transform: "rotate(-8deg)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 150,
          width: 620,
          height: 430,
          borderRadius: "52% 48% 44% 56% / 48% 52% 48% 52%",
          background: "rgba(255,246,221,0.6)",
          transform: "rotate(12deg)",
        }}
      />
      <div
        aria-hidden="true"
        data-blob-cinza="1"
        style={{
          position: "absolute",
          top: 157,
          left: 481,
          width: 715,
          height: 355,
          borderRadius: "48% 52% 56% 44% / 56% 48% 52% 44%",
          background: "#f1f3f1",
          transform: "rotate(-6deg)",
        }}
      />

      <div
        data-passos-grid="1"
        style={{
          position: "relative",
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))",
          gap: "clamp(32px,5vw,64px)",
          alignItems: "center",
        }}
      >
        <div
          data-passos-texto="1"
          style={{
            alignSelf: "center",
            marginTop: "clamp(0px,4vw,48px)",
            paddingLeft: "clamp(0px,3vw,40px)",
            maxWidth: 400,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#7a5600",
            }}
          >
            Passo a passo
          </p>
          <h2
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(25px,3.2vw,33px)",
              lineHeight: 1.22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#1f2329",
              maxWidth: "13ch",
            }}
          >
            Quatro passos entre o problema e o serviço feito
          </h2>
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: 340,
              fontSize: 15,
              lineHeight: 1.7,
              color: "#565d66",
            }}
          >
            Você descreve uma vez e acompanha até o fim. O dinheiro só é liberado quando você
            aprovar.
          </p>
        </div>
        <div
          data-passos-cards="1"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))",
            gap: "clamp(14px,2vw,22px)",
            maxWidth: 480,
          }}
        >
          {PASSOS.map((p) => (
            <div
              key={p.num}
              style={{
                background: "#fff",
                border: "1px solid #e4e7e4",
                borderRadius: 16,
                padding: "26px 22px",
                boxShadow:
                  "0 2px 6px rgba(31,35,41,0.06),0 30px 60px -24px rgba(31,35,41,0.45)",
                transform: `translateY(${p.desloca})`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#fff6dd",
                    color: "#7a5600",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {p.paths.map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#868d95",
                  }}
                >
                  {p.num}
                </span>
              </div>
              <h3
                style={{
                  margin: "18px 0 0",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                  color: "#1f2329",
                }}
              >
                {p.titulo}
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "#565d66" }}>
                {p.texto}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
