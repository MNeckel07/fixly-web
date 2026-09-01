/**
 * O NOME "Fixly" — fonte única da verdade do logotipo escrito.
 *
 * ⚠️ POR QUE ISTO EXISTE COMO COMPONENTE PRÓPRIO (Fixly 12).
 *
 * O nome era desenhado em DOIS lugares, um para cada root layout (a landing e o
 * produto foram separados na v15), e as duas cópias divergiram sem ninguém ver:
 *
 *   produto  -> `Fi<span style={{color:"#FFC107"}}>x</span>ly`   (amarelo)
 *   landing  -> `Fi<span className="text-amarelo-tinta">x</span>ly`
 *
 * e `--color-amarelo-tinta` vale `#7a5600`, que é MARROM. Na landing o X
 * simplesmente não era amarelo. O dono relatou como "o amarelo do X está
 * diferente" — e estava mesmo: eram dois amarelos, um deles nem amarelo.
 *
 * ⚠️ E OS DOIS ESTAVAM ERRADOS. No logotipo oficial (`Visual/logo1.png`) o
 * "Fixly" é INTEIRO escuro e o amarelo é o PINGO DO "i". O X nunca foi amarelo.
 *
 * Isso resolve de quebra a briga que criou o `amarelo-tinta`: `#FFC107` em
 * texto pequeno sobre branco não passa em contraste, e por isso alguém pegou a
 * variante escura. O pingo do "i" não é texto, é um ponto decorativo — a regra
 * de contraste de texto não se aplica a ele, e o nome fica legível porque é
 * escuro, como no logo.
 *
 * A cor vem em `style` inline de propósito: token de CSS foi exatamente o que
 * permitiu as duas cópias divergirem, e cada root layout tem o seu.
 */

const TINTA = "#1F2329";
const AMARELO = "#FFC107";

export function Wordmark({
  fontSize,
  variant = "dark",
  className = "",
}: {
  /** Em px. O pingo é dimensionado a partir daqui, então a marca escala inteira. */
  fontSize: number;
  /** `light` = sobre fundo escuro (o nome fica branco; o pingo segue amarelo). */
  variant?: "light" | "dark";
  className?: string;
}) {
  const cor = variant === "light" ? "#FFFFFF" : TINTA;
  /**
   * ⚠️ ESTES NÚMEROS FORAM MEDIDOS, NÃO ESTIMADOS.
   *
   * O pingo do "i" da Poppins 700 foi desenhado num canvas e lido pixel a
   * pixel, na fonte e no peso reais do logotipo:
   *
   *   altura do pingo ....... 0,1633 em     largura ...... 0,1733 em
   *   topo acima da baseline  0,7833 em     centro X ..... 49,8% da largura do "i"
   *
   * O primeiro palpite usava 0,14 em e o pingo escuro do glifo aparecia por
   * baixo do amarelo, como uma sombra. `0.175` cobre a altura E a largura (ele
   * é levemente mais largo que alto) com folga para o antisserrilhado.
   *
   * `top` sai do centro do glifo: 0,0545 (topo) + metade da altura, menos
   * metade do círculo novo. Se a fonte da marca mudar, MEÇA de novo — não
   * ajuste no olho.
   */
  const pingo = Math.max(2, fontSize * 0.175);
  const topoDoPingo = fontSize * 0.0487;

  return (
    <span style={{ fontSize, color: cor }} className={`font-bold tracking-tight ${className}`}>
      F
      <span className="relative inline-block">
        i
        {/*
          O pingo amarelo cobre o pingo original do "i". Fica por cima em vez de
          usar um "ı" sem pingo (U+0131): letra fora do alfabeto latino básico
          corre o risco de cair em outra fonte no meio da palavra, e aí o nome
          da marca sai com uma letra de tipo diferente.
        */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: topoDoPingo,
            width: pingo,
            height: pingo,
            transform: "translateX(-50%)",
            borderRadius: "50%",
            background: AMARELO,
          }}
        />
      </span>
      xly
    </span>
  );
}
