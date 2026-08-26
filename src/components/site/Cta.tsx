import { ArrowRight } from "lucide-react";
import { CTA_LABEL, CTA_MICRO, links } from "@/lib/site";

/**
 * O BOTÃO — cinco aparições, um texto só.
 *
 * O texto vem de `CTA_LABEL` de propósito: variar a palavra entre as repetições
 * quebra o reconhecimento e torna impossível medir qual posição converteu.
 *
 * Não é `target="_blank"`. O cadastro é a continuação natural da leitura, não
 * um anexo: abrir aba nova faria a pessoa perder o lugar e voltar para uma
 * landing que ela já leu.
 */
export function Cta({
  tamanho = "grande",
  micro = true,
  alinhamento = "esquerda",
}: {
  tamanho?: "grande" | "compacto";
  micro?: boolean;
  alinhamento?: "esquerda" | "centro";
}) {
  const grande = tamanho === "grande";

  return (
    <div className={alinhamento === "centro" ? "text-center" : ""}>
      <a
        href={links.cadastroContratante}
        className={[
          "group inline-flex items-center gap-2.5 rounded-xl bg-amarelo font-semibold text-tinta",
          "shadow-placa transition-[transform,box-shadow,background-color] duration-200",
          "hover:-translate-y-0.5 hover:bg-[#ffca2b] hover:shadow-alta",
          "active:translate-y-0 active:shadow-placa",
          "motion-reduce:transform-none motion-reduce:transition-none",
          grande ? "px-7 py-4 text-[17px]" : "px-5 py-2.5 text-[15px]",
        ].join(" ")}
      >
        {CTA_LABEL}
        <ArrowRight
          className={[
            "shrink-0 transition-transform duration-200",
            "group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0",
            grande ? "size-5" : "size-4",
          ].join(" ")}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </a>

      {micro && (
        <p
          className={[
            "mt-3.5 text-[13.5px] leading-relaxed text-grafite",
            alinhamento === "centro" ? "mx-auto max-w-md" : "max-w-md",
          ].join(" ")}
        >
          {CTA_MICRO}
        </p>
      )}
    </div>
  );
}
