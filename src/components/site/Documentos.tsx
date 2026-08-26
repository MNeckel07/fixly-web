import { Check, UserCheck } from "lucide-react";
import { DOCUMENTOS } from "@/lib/site";
import { Cta } from "./Cta";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * DOCUMENTOS — derruba "quem é essa pessoa que vai entrar na minha casa?".
 *
 * Tratamento DELIBERADAMENTE QUIETO. A ousadia da página inteira já foi gasta
 * na trilha do escrow; um segundo elemento chamativo aqui anularia os dois.
 * A força vem do conteúdo — listar os sete, com nome, é mais persuasivo do que
 * qualquer selo ou carimbo desenhado.
 *
 * Aqui mora o CTA nº 3: é o fim do par escrow + conferência, o ponto em que as
 * duas maiores objeções acabaram de cair.
 */
export function Documentos() {
  return (
    <Secao
      tom="branco"
      eyebrow="Quem entra na sua casa"
      titulo="Sete documentos. Conferidos por uma pessoa, um a um."
      lead="Não é robô, não é “cadastro validado”, não é selo comprado. Antes de um profissional existir na Fixly, alguém da nossa equipe abriu cada arquivo e olhou."
    >
      <Reveal>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-zinco bg-zinco sm:grid-cols-2">
          {DOCUMENTOS.map(({ nome, detalhe }) => (
            <li key={nome} className="flex items-start gap-3.5 bg-white px-6 py-5">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-verde-fundo text-verde"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span>
                <span className="text-[15.5px] font-semibold text-tinta">{nome}</span>
                {detalhe && (
                  <span className="block text-[13.5px] leading-snug text-grafite">
                    {detalhe}
                  </span>
                )}
              </span>
            </li>
          ))}

          {/* A oitava célula fecha a grade e carrega a consequência. */}
          <li className="flex items-center gap-3.5 bg-amarelo-fundo px-6 py-5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-amarelo text-tinta"
            >
              <UserCheck className="size-4.5" strokeWidth={2.25} />
            </span>
            <span className="text-[14.5px] leading-snug font-medium text-amarelo-tinta">
              Faltou um? Não entra.
            </span>
          </li>
        </ul>
      </Reveal>

      <Reveal>
        <p className="mt-8 max-w-2xl text-[16px] leading-relaxed text-grafite">
          É por isso que o seu cadastro também passa por conferência —{" "}
          <strong className="font-semibold text-tinta">
            a porta é a mesma para os dois lados
          </strong>
          , e é o que faz valer a pena estar aqui.
        </p>
      </Reveal>

      <div className="mt-12">
        <Cta />
      </div>
    </Secao>
  );
}
