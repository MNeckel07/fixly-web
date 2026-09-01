import { CTA_LABEL, links } from "@/lib/site";
import { Marca } from "./Marca";

/**
 * Cabeçalho — fica grudado no topo porque a decisão de clicar pode acontecer em
 * qualquer altura da leitura, e voltar ao topo para achar o botão é atrito puro.
 *
 * ⚠️ `backdrop-blur` aqui é seguro porque este cabeçalho NÃO tem filho
 * `position: fixed`. Se algum dia entrar um modal ou menu suspenso aqui dentro,
 * ele precisa ir por portal no `document.body`: um ancestral com
 * `backdrop-filter` cria um novo contexto de contenção e o filho fixo passa a
 * se posicionar em relação AO CABEÇALHO, não à janela — o modal aparece
 * espremido dentro da barra, sem erro nenhum.
 *
 * "Entrar" é link de texto, nunca botão: existe só como saída para quem já tem
 * conta, e não pode competir com a única ação da página.
 *
 * ⚠️ "Trabalhe na Fixly" (Fixly 12) segue a MESMA regra, e por isso também é
 * texto. O dono pediu o atalho para o profissional aqui em cima; transformá-lo
 * num segundo botão amarelo criaria duas ações de mesmo peso lado a lado, e a
 * página voltaria a não ter uma ação principal. Ele leva para a seção
 * `#para-profissionais`, não direto para o cadastro: quem clica aqui está
 * decidindo se entra, e ainda não decidiu.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinco bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#topo" className="rounded-md" aria-label="Fixly, início">
          <Marca size={24} prioridade />
        </a>

        <div className="flex items-center gap-2 sm:gap-5">
          <a
            href="#para-profissionais"
            className="hidden rounded-md px-1 py-2 text-[14.5px] font-medium text-grafite transition-colors hover:text-tinta sm:inline-flex"
          >
            Trabalhe na Fixly
          </a>
          <a
            href={links.login}
            className="rounded-md px-1 py-2 text-[14.5px] font-medium text-grafite transition-colors hover:text-tinta"
          >
            Entrar
          </a>
          <a
            href={links.cadastroContratante}
            className="hidden rounded-lg bg-amarelo px-4 py-2.5 text-[14.5px] font-semibold text-tinta shadow-placa transition-colors hover:bg-[#ffca2b] sm:inline-flex"
          >
            {CTA_LABEL}
          </a>
        </div>
      </div>
    </header>
  );
}
