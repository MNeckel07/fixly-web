/**
 * A MARCA — símbolo + "Fixly", com o pingo do i em âmbar.
 *
 * ⚠️ O PINGO É O ELEMENTO DE MARCA, e ele é desenhado, não digitado: o "i" da
 * fonte entra sem pingo e um <span> redondo âmbar é posicionado por cima. Foi
 * assim no design e é assim no logotipo oficial.
 *
 * Isto já deu problema antes: quando a landing e o app se separaram, cada lado
 * ganhou uma cópia da marca e a da landing pintou o amarelo de `#7a5600`
 * (marrom, a variante legível para TEXTO). O dono viu na hora — "o amarelo do X
 * está diferente". Regra de contraste de texto não se aplica a um pingo, que é
 * elemento gráfico: aqui o âmbar é o `#ffc107` puro, sempre.
 *
 * As medidas do pingo saem proporcionais ao tamanho do texto para a marca não
 * desmontar entre o cabeçalho (29px) e o rodapé (19px).
 */
export function Marca({
  tamanhoTexto,
  alturaSimbolo,
  cor,
}: {
  /** px do wordmark — o pingo é dimensionado a partir daqui. */
  tamanhoTexto: number;
  /** px de altura do símbolo à esquerda. */
  alturaSimbolo: number;
  cor: string;
}) {
  const pingo = tamanhoTexto * 0.176;
  const topo = tamanhoTexto * 0.048;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fixly-symbol.png"
        alt=""
        style={{ height: alturaSimbolo, width: "auto", display: "block" }}
      />
      <span
        style={{
          fontSize: tamanhoTexto,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: cor,
          position: "relative",
        }}
      >
        F
        <span style={{ position: "relative", display: "inline-block" }}>
          i
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: topo,
              width: pingo,
              height: pingo,
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background: "#ffc107",
            }}
          />
        </span>
        xly
      </span>
    </>
  );
}
