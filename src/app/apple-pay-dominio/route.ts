import { NextResponse } from "next/server";

/**
 * APPLE PAY — VERIFICAÇÃO DE DOMÍNIO
 * ==================================
 *
 * Para o Apple Pay funcionar **na web**, a Apple exige provar que quem pede o
 * pagamento é dono do domínio. A prova é um arquivo de texto servido, sem
 * redirecionamento, em:
 *
 *     https://<dominio>/.well-known/apple-developer-merchantid-domain-association
 *
 * O conteúdo vem do Stripe (Dashboard → Settings → Payments → Apple Pay → Add
 * domain) e mora em `APPLE_PAY_DOMAIN_ASSOCIATION`, não num arquivo comitado:
 * o texto muda quando o domínio é registrado de novo, e os dois serviços do
 * Render rodam o MESMO código — só o site precisa dele.
 *
 * ⚠️ POR QUE ESTA ROTA NÃO SE CHAMA `.well-known`.
 * O App Router do Next **ignora toda pasta que começa com ponto** — uma
 * `src/app/.well-known/…/route.ts` compila sem reclamar e simplesmente não
 * existe no build (conferido: não aparece na lista de rotas). O caminho de
 * verdade é criado pelo `rewrite` em `next.config.ts`, que aponta a URL que a
 * Apple visita para esta rota aqui. Se alguém "arrumar" o nome da pasta um
 * dia, o Apple Pay volta a falhar em silêncio.
 *
 * Detalhe que economiza dinheiro, e por isso vale repetir: pelo Stripe o Apple
 * Pay **não exige a conta de desenvolvedor da Apple** (US$ 99/ano). O
 * certificado é do Stripe; esta verificação de domínio é tudo o que falta.
 *
 * ⚠️ O GOOGLE PAY NÃO PRECISA DISTO — basta a chave do Stripe. Enquanto a
 * variável não existir, a rota devolve 404, que é a resposta honesta: o
 * domínio não está verificado.
 *
 * ⚠️ SEM CACHE E COMO TEXTO PURO. A Apple lê o corpo byte a byte; um
 * `Content-Type` de JSON, ou uma resposta em cache com o conteúdo antigo,
 * derrubam a verificação sem dizer por quê.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const conteudo = process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
  if (!conteudo) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(conteudo.trim(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
