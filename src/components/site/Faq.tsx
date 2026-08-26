import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PERGUNTAS } from "@/lib/faq";
import { Secao } from "./Secao";

/**
 * FAQ — a última barreira antes do fecho.
 *
 * Este componente é SERVIDOR de propósito: o accordion do shadcn já é a
 * fronteira de cliente, e ela é a menor possível. As perguntas e respostas vão
 * no HTML como texto — nenhum `useState` daqui, nenhum dado buscado no cliente.
 *
 * `type="single" collapsible` em vez de `multiple`: com oito perguntas abertas
 * ao mesmo tempo a pessoa perde o lugar na rolagem.
 */
export function Faq() {
  return (
    <Secao
      id="perguntas"
      tom="branco"
      eyebrow="Perguntas frequentes"
      titulo="O que costumam perguntar antes de chamar alguém."
      larguraTexto="estreita"
    >
      <div className="mt-12 max-w-3xl">
        <Accordion type="single" collapsible className="border-t border-zinco">
          {PERGUNTAS.map(({ p, r }, i) => (
            <AccordionItem
              key={p}
              value={`p-${i}`}
              className="border-b border-zinco not-last:border-b"
            >
              <AccordionTrigger className="gap-6 py-5 text-left font-sans text-[16.5px] font-semibold text-tinta hover:no-underline **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-amarelo-tinta">
                {p}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[15.5px] leading-relaxed text-grafite">
                <p className="max-w-[62ch]">{r}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Secao>
  );
}
