import Image from "next/image";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * Assinatura da marca — símbolo + "Fixly".
 *
 * ⚠️ A proporção é definida pelo dono e vale aqui igual vale no produto: o
 * SÍMBOLO é 30% mais alto que a fonte do nome, sobrando margem acima e abaixo
 * do texto em vez de os dois terminarem na mesma altura. `size` é a referência
 * do TEXTO, não do símbolo.
 */
const SYMBOL_RATIO = 1.3;

export function Marca({
  size = 26,
  /**
   * `true` só no cabeçalho, que está acima da dobra. No rodapé isto tem que ser
   * `false`: marcar como prioritário uma imagem que ninguém vê no primeiro
   * quadro disputa banda com o que realmente decide o LCP.
   */
  prioridade = false,
}: {
  size?: number;
  prioridade?: boolean;
}) {
  const fontSize = size * 0.92;
  const symbolHeight = Math.round(fontSize * SYMBOL_RATIO);

  return (
    <span className="inline-flex items-center gap-2 leading-none select-none">
      <Image
        src="/fixly-symbol.png"
        alt=""
        aria-hidden="true"
        width={symbolHeight}
        height={symbolHeight}
        priority={prioridade}
        loading={prioridade ? undefined : "lazy"}
        className="block shrink-0 w-auto"
        style={{ height: symbolHeight }}
      />
      {/* Mesmo componente do produto. Antes eram dois desenhos diferentes e o
          X daqui saía em `#7a5600` (marrom), não em amarelo. */}
      <Wordmark fontSize={fontSize} className="font-sans" />
    </span>
  );
}
