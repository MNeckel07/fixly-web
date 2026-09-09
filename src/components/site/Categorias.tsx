import Link from "next/link";
import { links, CATEGORIAS } from "@/lib/site";

/**
 * A ESTEIRA DE CATEGORIAS — laço infinito, sem emenda.
 *
 * O truque: a lista é renderizada DUAS vezes e a faixa anda de `-50%`. Quando a
 * animação reinicia, a segunda cópia está exatamente onde a primeira começou —
 * ninguém vê o corte. Por isso `width: max-content` e não uma largura fixa: a
 * conta do -50% só fecha se a faixa medir exatamente as duas cópias.
 *
 * As duas máscaras nas pontas dissolvem os itens no fundo em vez de cortá-los
 * no meio de uma palavra.
 *
 * ⚠️ Os nomes vêm de `CATEGORIAS` (lib/site.ts), que espelha
 * `service_categories.featured` no banco. Os ícones são pareados por posição —
 * mexer na ordem lá troca os ícones aqui. Se a lista mudar de tamanho, o
 * `aria-hidden` da segunda cópia continua valendo: o leitor de tela lê a lista
 * uma vez só.
 */
const ICONES: Record<string, string[]> = {
  Eletricista: [
    "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  ],
  Encanador: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  ],
  "Marido de aluguel": [
    "m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9",
    "M17.64 15 22 10.64",
    "m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91",
  ],
  "Gesso e drywall": [
    "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
    "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
    "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
  ],
  Marcenaria: [
    "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
    "m14.5 12.5 2-2",
    "m11.5 9.5 2-2",
    "m8.5 6.5 2-2",
    "m17.5 15.5 2-2",
  ],
  Pintor: [
    "m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08",
    "M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z",
  ],
  "Pisos e revestimentos": ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  "Pequenos reparos": ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
};

function Icone({ nome }: { nome: string }) {
  const paths = ICONES[nome] ?? [];
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Categorias() {
  const lista = CATEGORIAS.map((c) => c.nome);

  return (
    <section
      id="categorias"
      style={{ background: "#fafafa", position: "relative", overflow: "hidden", zIndex: 1 }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 180,
          background: "linear-gradient(to right,#fafafa 20%,rgba(250,250,250,0))",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 180,
          background: "linear-gradient(to left,#fafafa 20%,rgba(250,250,250,0))",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          width: "max-content",
          padding: "clamp(56px,9vw,116px) 0 16px",
          willChange: "transform",
          animation: "fx-marquee 34s linear infinite",
        }}
      >
        {[0, 1].map((copia) =>
          lista.map((nome) => (
            <Link
              key={`${copia}-${nome}`}
              href={links.cadastroContratante}
              className="fx-cat"
              // a segunda cópia existe só para o laço não ter emenda; o leitor
              // de tela lê a lista uma vez
              aria-hidden={copia === 1 || undefined}
              tabIndex={copia === 1 ? -1 : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                margin: "0 30px",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#1f2329",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#f1f3f1",
                  color: "#565d66",
                }}
              >
                <Icone nome={nome} />
              </span>
              {nome}
            </Link>
          )),
        )}
      </div>
    </section>
  );
}
