import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * COMO FUNCIONA — derruba "vou ter que pechinchar com três empresas?".
 *
 * Numeração é legítima AQUI e só aqui: isto é uma sequência de verdade, a ordem
 * carrega informação que a pessoa precisa (o pagamento vem depois da proposta,
 * a aprovação vem depois do serviço). Nas outras seções não há passo nenhum e
 * numerar seria decoração.
 */

const PASSOS = [
  {
    titulo: "Conte o problema",
    texto:
      "Categoria, descrição e fotos. Foto de torneira pingando vale mais que três parágrafos.",
  },
  {
    titulo: "O pedido vai para vários de uma vez",
    texto:
      "Você não liga para ninguém, não pede orçamento a três empresas, não espera retorno. Quem atende a sua categoria na sua região recebe o pedido.",
  },
  {
    titulo: "As propostas chegam",
    texto:
      "Cada profissional manda o preço dele e o prazo. Achou caro? Faça uma contra-proposta. Ele pode responder com outro valor. Vai e volta até fechar.",
  },
  {
    titulo: "Acompanhe e avalie",
    texto:
      "Você vê o profissional a caminho no mapa. No fim, você aprova o serviço — e é essa aprovação que solta o pagamento.",
  },
];

export function ComoFunciona() {
  return (
    <Secao
      id="como-funciona"
      eyebrow="Como funciona"
      titulo="Você descreve uma vez. Eles disputam o seu serviço."
    >
      <Reveal>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-zinco bg-zinco sm:grid-cols-2">
          {PASSOS.map(({ titulo, texto }, i) => (
            <li key={titulo} className="flex gap-5 bg-white p-6 sm:p-8">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-amarelo-borda bg-amarelo-fundo font-mono text-[13px] font-medium text-amarelo-tinta"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-[18px] font-bold tracking-tight text-tinta">
                  {titulo}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-grafite">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </Secao>
  );
}
