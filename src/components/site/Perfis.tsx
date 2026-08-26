import { ArrowRight, Building2, Hammer, House, Ruler } from "lucide-react";
import { links } from "@/lib/site";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * PERFIS DE USO — derruba "isso é pra mim?".
 *
 * O quarto cartão é o do PROFISSIONAL e por isso é o único visualmente
 * diferente: é a outra ponta do mercado, com CTA próprio. Ele nunca aparece
 * acima da dobra — dois públicos disputando o topo diluem os dois.
 */

const PERFIS = [
  {
    Icone: House,
    titulo: "Casa e apartamento",
    texto:
      "O vazamento de domingo, a tomada que parou, o quarto para pintar antes da mudança.",
  },
  {
    Icone: Building2,
    titulo: "Comércio",
    texto:
      "A loja não pode fechar. Marque como urgente e receba propostas de quem atende agora.",
  },
  {
    Icone: Ruler,
    titulo: "Reforma",
    texto:
      "Serviço grande vai por orçamento com visita técnica, não por preço no escuro.",
  },
];

export function Perfis() {
  return (
    <Secao eyebrow="Perfis de uso" titulo="Não tem um jeito só de usar.">
      <div className="mt-12 grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <Reveal>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-zinco bg-zinco sm:grid-cols-3">
            {PERFIS.map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="flex h-full flex-col bg-white p-6">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-lg border border-zinco bg-zinco-claro text-tinta"
                >
                  <Icone className="size-[18px]" strokeWidth={2} />
                </span>
                <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight text-tinta">
                  {titulo}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-grafite">{texto}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={90}>
          <article className="flex h-full flex-col rounded-2xl border-2 border-tinta bg-tinta p-7 text-white">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-lg bg-amarelo text-tinta"
            >
              <Hammer className="size-[18px]" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight text-white">
              Você é o profissional
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-zinco">
              Você não paga para ver pedido. Recebe pedidos da sua região, manda
              o seu preço e saca no dia seguinte à aprovação.
            </p>
            <a
              href={links.cadastroPrestador}
              className="group mt-5 inline-flex items-center gap-2 self-start rounded-lg border border-white/25 px-4 py-2.5 text-[14.5px] font-medium text-white transition-colors hover:border-amarelo hover:text-amarelo"
            >
              Cadastrar como profissional
              <ArrowRight
                className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </a>
          </article>
        </Reveal>
      </div>
    </Secao>
  );
}
