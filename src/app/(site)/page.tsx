import { Categorias } from "@/components/site/Categorias";
import { ComoFunciona } from "@/components/site/ComoFunciona";
import { Documentos } from "@/components/site/Documentos";
import { Escrow } from "@/components/site/Escrow";
import { Faq } from "@/components/site/Faq";
import { Fecho } from "@/components/site/Fecho";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { Perfis } from "@/components/site/Perfis";
import { Privacidade } from "@/components/site/Privacidade";
import { QuantoCusta } from "@/components/site/QuantoCusta";
import { ParaProfissionais } from "@/components/site/ParaProfissionais";
import { PERGUNTAS } from "@/lib/faq";
import { CATEGORIAS, SITE_ORIGIN, links } from "@/lib/site";

/**
 * A landing.
 *
 * Página estática por inteiro: nenhum `await` de dado, nenhuma sessão, nenhuma
 * chamada de rede. Ela é gerada no build e servida como HTML pronto — que é o
 * que faz o LCP caber no orçamento em 4G.
 *
 * ⚠️ Esta página NÃO conhece o sistema. Não importa nada de `sistema-web`, não
 * fala com o Supabase e não sabe se existe sessão. Os únicos pontos de contato
 * são os links de `lib/site.ts`.
 */

/**
 * Dados estruturados.
 *
 * ⚠️ NADA DE `aggregateRating` NEM `review`: seriam prova social inventada, e no
 * dado estruturado o Google trata isso como má-fé, não como descuido. Pelo mesmo
 * motivo não há `priceRange` chutado nem endereço fictício — quando houver
 * endereço e CNPJ de verdade, entram aqui e o resultado rico fica mais forte.
 */
function dadosEstruturados() {
  const negocio = {
    "@type": "LocalBusiness",
    "@id": `${SITE_ORIGIN}/#fixly`,
    name: "Fixly",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/fixly-icon.png`,
    image: `${SITE_ORIGIN}/fixly-icon.png`,
    description:
      "Plataforma de serviços residenciais e comerciais. O profissional passa por conferência documental antes de entrar, e o pagamento fica retido até o contratante aprovar o serviço.",
    areaServed: { "@type": "Country", name: "Brasil" },
    currenciesAccepted: "BRL",
    paymentAccepted: "Pix, Cartão de crédito",
  };

  const servico = {
    "@type": "Service",
    "@id": `${SITE_ORIGIN}/#servico`,
    name: "Serviços residenciais sob demanda",
    serviceType: CATEGORIAS.map((c) => c.nome),
    provider: { "@id": `${SITE_ORIGIN}/#fixly` },
    areaServed: { "@type": "Country", name: "Brasil" },
    description:
      "Descreva o serviço e receba propostas de profissionais com documentação conferida. O pagamento fica retido até a aprovação do contratante.",
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: links.cadastroContratante,
    },
  };

  const faq = {
    "@type": "FAQPage",
    "@id": `${SITE_ORIGIN}/#faq`,
    mainEntity: PERGUNTAS.map(({ p, r }) => ({
      "@type": "Question",
      name: p,
      acceptedAnswer: { "@type": "Answer", text: r },
    })),
  };

  return { "@context": "https://schema.org", "@graph": [negocio, servico, faq] };
}

export default function Home() {
  return (
    <>
      {/* Bloco de dados: `application/ld+json` não é script executável, então
          não precisa de exceção no CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados()) }}
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-tinta focus:px-4 focus:py-2.5 focus:text-[15px] focus:font-medium focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Header />

      <main id="conteudo" className="flex-1">
        <Hero />
        <Categorias />
        <ComoFunciona />
        <Escrow />
        <Documentos />
        <Privacidade />
        <QuantoCusta />
        <ParaProfissionais />
        <Perfis />
        <Faq />
        <Fecho />
      </main>

      <Footer />
    </>
  );
}
