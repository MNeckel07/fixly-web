import { BadgeCheck, Camera, Landmark, MapPinOff, ShieldCheck } from "lucide-react";
import { Cta } from "./Cta";

/**
 * HERO — a tese da página.
 *
 * ⚠️ REGRA DE LCP: o `<h1>` é texto de servidor, sem animação de entrada e sem
 * espera por dado nenhum. O elemento que o navegador vai medir como LCP pinta
 * no primeiro quadro. A ilustração ao lado anima, mas ela não é o LCP e a
 * animação é CSS puro — nenhum JS entra no caminho crítico.
 *
 * A ilustração mostra O DISPARO: um pedido só sai e alcança todos os
 * profissionais que atendem aquela categoria naquela região. É o movimento mais
 * característico do produto e não precisa de número nenhum para ser verdadeiro.
 */

const SELOS = [
  { Icone: BadgeCheck, texto: "Documento conferido" },
  { Icone: Landmark, texto: "Dinheiro retido até você aprovar" },
  { Icone: MapPinOff, texto: "Endereço só depois do aceite" },
];

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden border-b border-zinco">
      {/* Faixa de risco: o amarelo da marca ancorado no mundo da obra. */}
      <div
        aria-hidden="true"
        className="h-1.5 w-full bg-[repeating-linear-gradient(135deg,#ffc107_0_14px,#1f2329_14px_28px)] opacity-90"
      />

      {/*
        ⚠️ ALTURA DO HERO É REGRA DE CONVERSÃO, NÃO GOSTO.
        O botão TEM que caber acima da dobra num monitor de 1440×900 e num
        celular. A primeira versão usava `clamp(2.4rem,7vw,4.25rem)` e a
        headline quebrava em cinco linhas, empurrando o CTA para fora da tela —
        medido no Chrome, não estimado. Antes de aumentar qualquer tamanho aqui,
        tire um screenshot e confira onde o botão parou.
      */}
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-14 lg:py-20">
        {/* ── coluna do argumento ── */}
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amarelo-borda bg-amarelo-fundo px-3.5 py-1.5 font-mono text-[11.5px] font-medium tracking-[0.12em] text-amarelo-tinta uppercase">
            <ShieldCheck className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            Serviços para casa e comércio
          </p>

          <h1 className="max-w-[15ch] text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold text-tinta">
            Contrate para sua casa sem apostar em quem vai aparecer.
          </h1>

          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-grafite">
            Eletricista, encanador, pintor e mais. Todo profissional aqui teve{" "}
            <strong className="font-semibold text-tinta">
              sete documentos conferidos por uma pessoa
            </strong>{" "}
            — e o seu dinheiro fica retido até você aprovar o serviço.
          </p>

          <div className="mt-8">
            <Cta />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {SELOS.map(({ Icone, texto }) => (
              <li key={texto} className="flex items-center gap-2 text-[13.5px] font-medium text-grafite">
                <Icone className="size-4 shrink-0 text-amarelo-tinta" strokeWidth={2.25} aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        {/* ── coluna da ilustração: o disparo ── */}
        <DisparoDoPedido />
      </div>
    </section>
  );
}

function DisparoDoPedido() {
  return (
    <figure className="m-0">
      <div className="rounded-2xl border border-zinco bg-white p-5 shadow-placa sm:p-7">
        {/* o pedido */}
        <div className="rounded-xl border border-zinco bg-zinco-claro p-4">
          <p className="font-mono text-[10.5px] font-medium tracking-[0.14em] text-grafite-claro uppercase">
            Seu pedido
          </p>
          <p className="mt-2 font-display text-[19px] font-bold tracking-tight text-tinta">
            Eletricista
          </p>
          <p className="mt-1 text-[14.5px] leading-snug text-grafite">
            “A tomada da cozinha parou depois da chuva.”
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-grafite-claro">
            <Camera className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            2 fotos
          </p>
        </div>

        {/* o leque — um pedido, vários profissionais */}
        <svg
          viewBox="0 0 300 46"
          preserveAspectRatio="none"
          className="h-11 w-full"
          aria-hidden="true"
          focusable="false"
        >
          <g stroke="#c9cec9" strokeWidth="1.5" fill="none" strokeLinecap="round">
            <path className="linha-disparo" style={{ animationDelay: "0ms" }} d="M150 0 V14 Q150 22 140 22 H45 Q35 22 35 30 V46" />
            <path className="linha-disparo" style={{ animationDelay: "180ms" }} d="M150 0 V14 Q150 22 143 22 H108 Q98 22 98 30 V46" />
            <path className="linha-disparo" style={{ animationDelay: "360ms" }} d="M150 0 V14 Q150 22 157 22 H192 Q202 22 202 30 V46" />
            <path className="linha-disparo" style={{ animationDelay: "540ms" }} d="M150 0 V14 Q150 22 160 22 H255 Q265 22 265 30 V46" />
          </g>
        </svg>

        {/* os profissionais */}
        <ul className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="chip-prestador flex flex-col items-center gap-1.5 rounded-lg border border-zinco bg-canvas px-1 py-3"
              style={{ animationDelay: `${300 + i * 130}ms` }}
            >
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-full bg-tinta text-white"
              >
                <BadgeCheck className="size-4" strokeWidth={2.25} />
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.08em] text-grafite-claro uppercase">
                conferido
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="mt-3.5 text-center text-[13px] leading-relaxed text-grafite-claro">
        Um pedido só, disparado para todos os profissionais que atendem essa
        categoria na sua região.
      </figcaption>
    </figure>
  );
}
