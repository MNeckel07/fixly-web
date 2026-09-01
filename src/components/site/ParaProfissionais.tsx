import { ArrowRight, BadgeCheck, IdCard, Megaphone, ShieldCheck } from "lucide-react";
import { links } from "@/lib/site";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * PARA O PROFISSIONAL — a outra ponta do mercado (Fixly 12).
 *
 * A página inteira fala com quem CONTRATA. O `Perfis` tinha um cartão escuro
 * para o profissional, mas ele resolve "isso é pra mim?", não "por que eu
 * entraria?". O dono pediu explicitamente: *"escrever um pouco para convencer o
 * profissional a entrar e trabalhar para a gente, falando um pouco do profiler,
 * do cartão automático, e incluir a parte de anunciar a empresa"*, mais um
 * "FALAR SOBRE O SELO" em caixa alta.
 *
 * ⚠️ ELA FICA DEPOIS DE "QUANTO CUSTA", NÃO ANTES. Dois públicos disputando o
 * topo diluem os dois, e a regra da página é uma ação principal por vez. Quem
 * chega aqui já leu a proposta inteira; quem só quer contratar já converteu
 * três CTAs atrás.
 *
 * ⚠️ Nada de número inventado aqui. Não temos base de usuários para dizer
 * "milhares de profissionais", e prova social falsa numa página que vende
 * conferência de documentos é o jeito mais rápido de perder as duas coisas.
 * O argumento é o que o produto FAZ, que é verificável.
 */

const VANTAGENS = [
  {
    Icone: BadgeCheck,
    titulo: "Profiler: o seu perfil público",
    texto:
      "Uma página só sua, com os seus serviços, as suas fotos e as suas avaliações. Quem abre esse link pede direto para você, sem passar pela fila.",
  },
  {
    Icone: IdCard,
    titulo: "Cartão digital automático",
    texto:
      "A Fixly gera um cartão com o seu QR Code. A pessoa aponta a câmera, cai no seu Profiler e já pede o serviço. Você não desenha nada nem paga gráfica.",
  },
  {
    Icone: Megaphone,
    titulo: "Anuncie a sua empresa",
    texto:
      "Se você tem equipe, publique um anúncio da empresa e apareça para quem procura mão de obra para a obra inteira, não só para um reparo.",
  },
];

export function ParaProfissionais() {
  return (
    <Secao
      id="para-profissionais"
      tom="tinta"
      eyebrow="Para o profissional"
      titulo="Trabalhe na Fixly."
      lead="Você não paga para ver pedido, não paga mensalidade e não compra “lead”. Recebe os pedidos da sua região, envia o seu preço e saca no dia seguinte à aprovação do cliente."
    >
      <Reveal>
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {VANTAGENS.map(({ Icone, titulo, texto }) => (
            <li
              key={titulo}
              className="flex h-full flex-col rounded-2xl border border-white/12 bg-white/[0.04] p-6"
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-lg bg-amarelo text-tinta"
              >
                <Icone className="size-[18px]" strokeWidth={2.25} />
              </span>
              <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight text-white">
                {titulo}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-zinco">{texto}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      {/*
        O SELO ganha bloco próprio, e não um quarto cartão, porque ele não é uma
        ferramenta como as três de cima: é a consequência do trabalho bem feito.
        Misturar com o resto o transformaria em "mais um recurso".
      */}
      <Reveal delay={90}>
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border-2 border-amarelo bg-amarelo/[0.07] p-7 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-amarelo text-tinta"
          >
            <ShieldCheck className="size-6" strokeWidth={2.25} />
          </span>
          <div>
            <h3 className="font-display text-[19px] font-bold tracking-tight text-white">
              O Selo Fixly não se compra. Se conquista.
            </h3>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinco">
              Quem mantém média de 4,5 estrelas ou mais passa a exibir o Selo nas
              propostas, no Profiler e no cartão. É o que faz o cliente escolher
              você quando chegam três orçamentos parecidos. Não existe plano pago
              que coloque o Selo no seu perfil.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-10">
          <a
            href={links.cadastroPrestador}
            className="group inline-flex items-center gap-2 rounded-lg bg-amarelo px-5 py-3 text-[15px] font-semibold text-tinta shadow-placa transition-colors hover:bg-[#ffca2b]"
          >
            Quero trabalhar na Fixly
            <ArrowRight
              className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </a>
          <p className="mt-3 text-[13.5px] text-zinco">
            O cadastro passa pela mesma conferência de documentos que você leu
            acima. É ela que segura o nível aqui dentro.
          </p>
        </div>
      </Reveal>
    </Secao>
  );
}
