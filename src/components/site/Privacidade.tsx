import { MessageSquareOff, Radius } from "lucide-react";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * PRIVACIDADE — derruba "vou ficar recebendo ligação de vendedor, e vão saber
 * onde eu moro".
 *
 * Os dois blocos ilustram o mecanismo, não o adjetivo: o círculo mostra o que o
 * profissional REALMENTE vê antes do aceite, e o balão mostra o telefone já
 * mascarado, do jeito que chega do outro lado.
 */
export function Privacidade() {
  return (
    <Secao
      eyebrow="Seus dados"
      titulo="O seu endereço não é isca."
    >
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <article className="flex h-full flex-col rounded-2xl border border-zinco bg-white p-7">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-lg border border-zinco bg-zinco-claro text-tinta"
            >
              <Radius className="size-5" strokeWidth={2} />
            </span>
            <h3 className="mt-5 font-display text-[19px] font-bold tracking-tight text-tinta">
              Só o bairro, até você decidir
            </h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-grafite">
              Enquanto você avalia as propostas, o profissional vê a região e um
              círculo de aproximadamente 1 km. Seu número, seu apartamento e o
              ponto exato só aparecem depois que você aceita.
            </p>

            {/* o que ele vê antes do aceite */}
            <div className="mt-6 grid place-items-center rounded-xl border border-zinco bg-zinco-claro py-9">
              <div className="relative grid size-32 place-items-center">
                <span className="absolute inset-0 rounded-full border-2 border-dashed border-grafite-claro/45 bg-white/70" />
                <span className="absolute inset-7 rounded-full bg-amarelo/15" />
                <span className="relative font-mono text-[11px] tracking-[0.1em] text-grafite uppercase">
                  ~1 km
                </span>
              </div>
            </div>
            <p className="mt-3 text-center font-mono text-[11px] tracking-[0.08em] text-grafite-claro uppercase">
              sem alfinete, de propósito
            </p>
          </article>
        </Reveal>

        <Reveal delay={90}>
          <article className="flex h-full flex-col rounded-2xl border border-zinco bg-white p-7">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-lg border border-zinco bg-zinco-claro text-tinta"
            >
              <MessageSquareOff className="size-5" strokeWidth={2} />
            </span>
            <h3 className="mt-5 font-display text-[19px] font-bold tracking-tight text-tinta">
              Ninguém pega o seu telefone
            </h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-grafite">
              Telefone e e-mail digitados no chat são apagados automaticamente
              antes de a mensagem chegar do outro lado. Não é regra de boa
              conduta. É o banco de dados que apaga, e não tem como contornar
              pelo aplicativo.
            </p>

            {/* a mensagem como ela chega do outro lado */}
            <div className="mt-6 flex flex-1 flex-col justify-center gap-2.5 rounded-xl border border-zinco bg-zinco-claro p-5">
              <p className="max-w-[92%] rounded-xl rounded-bl-sm bg-white px-4 py-3 text-[14px] leading-snug text-tinta shadow-sm">
                Me chama no{" "}
                <span className="rounded bg-tinta px-1.5 py-0.5 font-mono text-[12px] text-amarelo">
                  ●●●●●●●●
                </span>{" "}
                que a gente resolve
              </p>
              <p className="pl-1 font-mono text-[10.5px] tracking-[0.08em] text-grafite-claro uppercase">
                apagado antes de enviar
              </p>
            </div>
          </article>
        </Reveal>
      </div>
    </Secao>
  );
}
