import { Zap } from "lucide-react";
import { CATEGORIAS, links } from "@/lib/site";
import { Cta } from "./Cta";
import { Reveal } from "./Reveal";
import { Secao } from "./Secao";

/**
 * CATEGORIAS — derruba "vocês atendem o meu caso?".
 *
 * Cada cartão é um LINK para o cadastro, não um campo de formulário. A página
 * de cadastro não lê querystring, então guardar a escolha aqui só faria a
 * pessoa responder a mesma pergunta duas vezes — e digitar duas vezes é pior
 * do que não digitar nenhuma.
 *
 * O exemplo embaixo de cada nome existe para a pessoa se reconhecer: ninguém
 * procura "serviço de elétrica", procura "a tomada parou".
 */
export function Categorias() {
  return (
    <Secao
      id="categorias"
      tom="branco"
      eyebrow="Categorias"
      titulo="O que está quebrado hoje?"
      lead="Escolha o serviço e descreva o problema com foto. Seu pedido vai para vários profissionais da sua região de uma vez."
    >
      <Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIAS.map(({ nome, exemplo }) => (
            <li key={nome}>
              <a
                href={links.cadastroContratante}
                className="group flex h-full flex-col rounded-xl border border-zinco bg-canvas p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-amarelo hover:shadow-placa motion-reduce:transform-none motion-reduce:transition-none"
              >
                <span className="font-display text-[17px] font-bold tracking-tight text-tinta">
                  {nome}
                </span>
                <span className="mt-1.5 text-[13.5px] leading-snug text-grafite">
                  {exemplo}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Express — urgência VERDADEIRA (existe no produto), sem contador falso. */}
      <Reveal>
        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-amarelo-borda bg-amarelo-fundo p-6 sm:flex-row sm:items-center sm:gap-5">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-amarelo text-tinta"
          >
            <Zap className="size-5" strokeWidth={2.25} />
          </span>
          <p className="text-[15.5px] leading-relaxed text-tinta">
            <strong className="font-semibold">Precisa hoje?</strong> Marque como
            urgente. A Fixly não cobra nada a mais por isso — quem decide se a
            pressa muda o preço é o profissional, no orçamento dele.
          </p>
        </div>
      </Reveal>

      <div className="mt-12">
        <Cta />
      </div>
    </Secao>
  );
}
