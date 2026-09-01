/**
 * Assinatura da marca: símbolo + "Fixly".
 *
 * Proporção (definida pelo dono): o SÍMBOLO é ~30% mais alto que a fonte do
 * nome — sobra margem para cima e para baixo do texto, em vez de os dois
 * terminarem na mesma altura. `size` continua sendo a referência do texto, então
 * nenhuma chamada existente precisa mudar de número.
 */
import { Wordmark } from "@/components/ui/Wordmark";

const SYMBOL_RATIO = 1.3; // altura do símbolo ÷ tamanho da fonte do nome

export function Logo({
  size = 28,
  variant = "light",
  symbolOnly = false,
}: {
  size?: number;
  variant?: "light" | "dark";
  symbolOnly?: boolean;
}) {
  const fontSize = size * 0.92;
  const symbolHeight = fontSize * SYMBOL_RATIO;

  return (
    <span className="inline-flex items-center gap-2 select-none leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fixly-symbol.png"
        alt="Fixly"
        style={{ height: symbolHeight, width: "auto" }}
        className="block shrink-0"
      />
      {/* O nome vem do `Wordmark`: era aqui que a cópia do produto e a da
          landing divergiam (ver o cabeçalho daquele arquivo). */}
      {!symbolOnly && <Wordmark fontSize={fontSize} variant={variant} />}
    </span>
  );
}
