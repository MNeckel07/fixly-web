import { Cta } from "./Cta";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * QUANTO CUSTA — derruba "onde está a pegadinha?".
 *
 * Aqui o preço é DIFERENCIAL, não objeção: o profissional não compra lead, logo
 * não precisa embutir esse custo no orçamento. Por isso a conta aparece inteira,
 * inclusive a nossa parte.
 *
 * ⚠️ NÚMEROS CONFERIDOS, não estimados. Batem com `lib/pricing.ts` do produto:
 *    PLATFORM_FEE_RATE = 0.15            → R$ 200 × 15% = R$ 30
 *    GATEWAY_FEE_RATES.cartao = 0.0498   → chargedTotal = 200 / (1 - 0,0498)
 *                                        = R$ 210,48
 *    A tarifa incide sobre o TOTAL cobrado, não sobre o preço do serviço — é
 *    divisão, não multiplicação. Por isso R$ 210,48 e não R$ 209,96.
 *    No Pix (0,99%) a tarifa sai da nossa comissão e o cliente não vê acréscimo.
 * Se a tabela do gateway mudar no produto, esta tabela mente. Conferir junto.
 */

const LINHAS = [
  { rotulo: "Você paga", pix: "R$ 200,00", cartao: "R$ 210,48", destaque: true },
  { rotulo: "O profissional recebe", pix: "R$ 170,00", cartao: "R$ 170,00", destaque: false },
  { rotulo: "Comissão da Fixly (15%)", pix: "R$ 30,00", cartao: "R$ 30,00", destaque: false },
  { rotulo: "Tarifa do cartão", pix: "—", cartao: "R$ 10,48", destaque: false },
];

export function QuantoCusta() {
  return (
    <Secao
      id="quanto-custa"
      tom="branco"
      eyebrow="Quanto custa"
      titulo="Você não paga nada para usar a Fixly."
      lead="A Fixly ganha uma comissão de 15% sobre o serviço, e só quando o serviço acontece. O profissional não paga para ver o seu pedido, não paga mensalidade e não compra “lead” — por isso ele não precisa embutir esse custo no orçamento que te manda."
    >
      <Reveal>
        <figure className="mt-12 m-0">
          <figcaption className="mb-4 font-mono text-[11.5px] tracking-[0.12em] text-grafite uppercase">
            Num serviço combinado em R$ 200
          </figcaption>

          <div className="overflow-x-auto rounded-2xl border border-zinco">
            <table className="w-full min-w-[30rem] border-collapse bg-white text-left">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-4 text-[13px] font-medium text-grafite-claro">
                    <span className="sr-only">Item</span>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-right font-mono text-[11.5px] font-medium tracking-[0.1em] text-grafite uppercase"
                  >
                    No Pix
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-right font-mono text-[11.5px] font-medium tracking-[0.1em] text-grafite uppercase"
                  >
                    No cartão
                  </th>
                </tr>
              </thead>
              <tbody>
                {LINHAS.map(({ rotulo, pix, cartao, destaque }) => (
                  <tr
                    key={rotulo}
                    className={`border-t border-zinco ${destaque ? "bg-amarelo-fundo" : ""}`}
                  >
                    <th
                      scope="row"
                      className={`px-6 py-4 text-[15px] font-normal ${
                        destaque ? "font-semibold text-tinta" : "text-tinta"
                      }`}
                    >
                      {rotulo}
                    </th>
                    <td
                      className={`px-6 py-4 text-right font-mono text-[15px] whitespace-nowrap ${
                        destaque ? "font-semibold text-tinta" : "text-grafite"
                      }`}
                    >
                      {pix}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono text-[15px] whitespace-nowrap ${
                        destaque ? "font-semibold text-tinta" : "text-grafite"
                      }`}
                    >
                      {cartao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      </Reveal>

      <Reveal>
        <p className="mt-6 max-w-2xl text-[15.5px] leading-relaxed text-grafite">
          No Pix, a tarifa sai da nossa comissão —{" "}
          <strong className="font-semibold text-tinta">
            o preço combinado é o preço
          </strong>
          . No cartão ela aparece porque a escolha do cartão foi sua. Nos dois
          casos o profissional recebe os mesmos R$ 170.
        </p>
      </Reveal>

      <div className="mt-12">
        <Cta />
      </div>
    </Secao>
  );
}
