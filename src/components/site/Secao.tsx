import type { ReactNode } from "react";

/**
 * Casca de seção — existe para que o ritmo vertical da página venha de UM lugar.
 *
 * ⚠️ Espaçamento entre seções mora só aqui (`py-*`). Nenhum componente filho
 * define margem de topo ou de base própria: é assim que se evita a briga clássica
 * de margens que se somam ou colapsam entre irmãos.
 */
export function Secao({
  id,
  eyebrow,
  titulo,
  lead,
  children,
  tom = "canvas",
  larguraTexto = "normal",
}: {
  id?: string;
  eyebrow?: string;
  titulo?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  tom?: "canvas" | "branco" | "tinta";
  larguraTexto?: "normal" | "estreita";
}) {
  const fundo =
    tom === "branco"
      ? "bg-white border-y border-zinco"
      : tom === "tinta"
        ? "bg-tinta text-white"
        : "bg-canvas";

  const escuro = tom === "tinta";

  return (
    <section id={id} className={`${fundo} py-20 sm:py-24`}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {(eyebrow || titulo || lead) && (
          <header className={larguraTexto === "estreita" ? "max-w-2xl" : "max-w-3xl"}>
            {eyebrow && (
              <p
                className={`mb-4 font-mono text-[11.5px] font-medium tracking-[0.14em] uppercase ${
                  escuro ? "text-amarelo" : "text-amarelo-tinta"
                }`}
              >
                {eyebrow}
              </p>
            )}
            {titulo && (
              <h2
                className={`text-[clamp(1.85rem,4.4vw,2.9rem)] font-extrabold ${
                  escuro ? "text-white" : "text-tinta"
                }`}
              >
                {titulo}
              </h2>
            )}
            {lead && (
              <p
                className={`mt-5 max-w-2xl text-[16.5px] leading-relaxed ${
                  escuro ? "text-zinco" : "text-grafite"
                }`}
              >
                {lead}
              </p>
            )}
          </header>
        )}

        {children}
      </div>
    </section>
  );
}
