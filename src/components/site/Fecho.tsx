import { Cta } from "./Cta";
import { Reveal } from "./Reveal";

/**
 * FECHO — o CTA nº 5, para quem leu a página inteira e ainda não clicou.
 *
 * Recapitula os três mecanismos na ordem em que apareceram, sem adjetivo novo:
 * quem chegou até aqui já entendeu, só precisa de permissão para agir.
 */
export function Fecho() {
  return (
    <section className="relative overflow-hidden bg-tinta py-24 text-white sm:py-28">
      {/* Faixa de risco, fechando o mesmo motivo que abriu o hero. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(135deg,#ffc107_0_14px,#1f2329_14px_28px)] opacity-90"
      />

      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="text-[clamp(1.9rem,5vw,3.1rem)] font-extrabold text-white">
            Descubra quem pode resolver isso hoje.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-zinco">
            Descreva o problema, receba propostas de profissionais conferidos e
            pague só quando estiver bom.
          </p>
          <div className="mt-10 [&_p]:text-white/55">
            <Cta alinhamento="centro" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
