import { Categorias } from "@/components/site/Categorias";
import { ComoFunciona } from "@/components/site/ComoFunciona";
import { Faq } from "@/components/site/Faq";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { Missao } from "@/components/site/Missao";
import { Perfis } from "@/components/site/Perfis";
import { Propostas } from "@/components/site/Propostas";
import { PERGUNTAS } from "@/lib/faq";
import { CATEGORIAS, SITE_ORIGIN, links } from "@/lib/site";

/**
 * A landing (design aprovado no Claude Design, 08/09/2026).
 *
 * Estática por inteiro: nenhum `await` de dado, nenhuma sessão, nenhuma chamada
 * de rede. É gerada no build e servida como HTML pronto — o que faz o LCP caber
 * no orçamento em 4G.
 *
 * ⚠️ Esta página NÃO conhece o sistema. Não fala com o Supabase e não sabe se
 * existe sessão. Os únicos pontos de contato são os links de `lib/site.ts`.
 *
 * O `Header` não aparece aqui: ele vive DENTRO do `Hero`, sobre o fundo escuro
 * inclinado. Renderizá-lo por fora o jogaria para cima do recorte.
 *
 * ORDEM DAS SEÇÕES — cada uma derruba uma pergunta, nesta ordem:
 *   Hero          "o que é isso?"
 *   Categorias    "atende o meu caso?"
 *   Como funciona "vou ter que pechinchar com cada um?"
 *   Propostas     "e se eu achar caro?"
 *   Perfis        "isso é pra mim ou pra quem presta serviço?"
 *   Missão        o fecho emocional, antes das últimas dúvidas
 *   FAQ           o resto
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

      {/* Pular para o conteúdo: invisível até receber foco pelo teclado.
          A classe é CSS puro (globals-site.css) — a versão anterior usava
          utilitárias do Tailwind, que saiu junto com a landing antiga. */}
      <a href="#conteudo" className="fx-pular">
        Pular para o conteúdo
      </a>

      <main id="conteudo">
        <Hero />
        <Categorias />
        <ComoFunciona />
        <Propostas />
        <Perfis />
        <Missao />
        <Faq />
      </main>

      <Footer />
    </>
  );
}
