import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { appRole } from "@/lib/appRole";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * ⚠️ O MESMO CÓDIGO SERVE DOIS DOMÍNIOS.
 *
 * Este arquivo veio da landing, onde só existia um site e `allow: "/"` era
 * óbvio. Aqui ele também responde em `fixly.fun`, o painel da equipe — e um
 * `robots.txt` liberando o painel para o Google desfaz, numa linha, o cuidado
 * de todo o `lib/appRole.ts` e do `noindex` do layout.
 *
 * Por isso o papel manda: no painel, `disallow: "/"` e nenhum sitemap.
 *
 * ⚠️ ESTE ARQUIVO FICA NA RAIZ DE `src/app`, FORA DO GROUP `(site)`.
 * Dentro de `(site)/` o Next simplesmente NÃO gera a rota — sem erro, sem
 * aviso: `/robots.txt` some da tabela de rotas do build e o site vai ao ar sem
 * robots. (O `sitemap.ts` no MESMO diretório funciona, o que torna a falha
 * ainda mais fácil de não notar.) Confira `/robots.txt` na tabela de rotas
 * depois de qualquer mexida aqui.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const painel = appRole((await headers()).get("host")) === "admin";

  if (painel) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  /**
   * ⚠️ `/api/` FORA DO ÍNDICE.
   *
   * O dono abriu o site e caiu no JSON do `/api/health` — que é público de
   * propósito (é o `healthCheckPath` do Render) e, sem esta linha, era
   * rastreável e indexável como qualquer página. Um endpoint de saúde num
   * resultado de busca é péssima porta de entrada: quem procura "Fixly" acha
   * `{"ok":true,...}` em vez da landing.
   *
   * ⚠️ `/admin` NÃO entra aqui, e a ausência é deliberada: no domínio do site
   * o painel já responde 404 (`lib/appRole.ts`), e listá-lo no robots.txt
   * anunciaria a existência dele para quem estiver varrendo. Robots é arquivo
   * público — o que se escreve nele é um mapa do que existe.
   */
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
