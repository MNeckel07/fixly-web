import { links } from "@/lib/site";
import { Marca } from "./Marca";

/**
 * Rodapé.
 *
 * ⚠️ Não referencia o painel administrativo em lugar nenhum. O painel vive em
 * outro domínio e responde 404 aqui de propósito — anunciar o endereço da
 * equipe numa página pública é entregar superfície de ataque de graça.
 */

const NAVEGACAO = [
  { href: "#como-funciona", texto: "Como funciona" },
  { href: "#seguranca", texto: "Segurança" },
  { href: "#quanto-custa", texto: "Quanto custa" },
  { href: "#perguntas", texto: "Perguntas frequentes" },
];

export function Footer() {
  return (
    <footer className="border-t border-zinco bg-canvas py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Marca size={22} />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-grafite">
              Serviços para casa e comércio, com profissional conferido e
              pagamento retido até você aprovar.
            </p>
          </div>

          <nav aria-label="Rodapé">
            <ul className="flex flex-col gap-3 sm:items-end">
              {NAVEGACAO.map(({ href, texto }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="-my-1 inline-block rounded py-1 text-[14.5px] text-grafite transition-colors hover:text-tinta"
                  >
                    {texto}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={links.cadastroPrestador}
                  className="-my-1 inline-block rounded py-1 text-[14.5px] text-grafite transition-colors hover:text-tinta"
                >
                  Sou profissional
                </a>
              </li>
              <li>
                <a
                  href={links.login}
                  className="-my-1 inline-block rounded py-1 text-[14.5px] text-grafite transition-colors hover:text-tinta"
                >
                  Entrar
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 border-t border-zinco pt-6">
          <p className="font-mono text-[11.5px] tracking-[0.06em] text-grafite-claro">
            © {new Date().getFullYear()} Fixly
          </p>
        </div>
      </div>
    </footer>
  );
}
