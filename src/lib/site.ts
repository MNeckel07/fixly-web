/**
 * COSTURA — ponto único de verdade das URLs e dos textos repetidos da landing.
 * ===========================================================================
 *
 * A landing nasceu como projeto SEPARADO e toda URL passava por aqui justamente
 * para o dia em que ela fosse juntada ao domínio do sistema. **Esse dia
 * chegou** (26/08/2026): a landing virou a raiz de `fixly.company`, dentro do
 * route group `(site)` deste mesmo projeto.
 *
 * O que a junção custou em código: as três linhas de `links` abaixo. Nenhum
 * componente da página foi tocado — era exatamente o que a costura prometia.
 *
 * ⚠️ POR QUE O APP NÃO SAIU DA RAIZ
 * O caminho "landing na raiz, app em app.fixly.company" quebraria dinheiro em
 * silêncio: a migração 0032 tem `https://fixly.company/api/cron/escrow` escrito
 * em SQL dentro do `pg_cron`, e o webhook do Mercado Pago aponta para o mesmo
 * domínio. Quem se acomodou foi a landing.
 *
 * ⚠️ A landing continua NÃO conhecendo o sistema: não importa nada de
 * `lib/auth`, não fala com o Supabase, não sabe se existe sessão. O contrato
 * segue sendo só os links daqui — o que mudou é que agora eles são relativos.
 */

/**
 * Onde vive o sistema (cadastro, login, app).
 *
 * Vazio = mesmo domínio, links relativos. É o estado normal desde a junção.
 * A variável continua existindo para o caso de a landing voltar a ser servida
 * de outro lugar (uma campanha em domínio próprio, por exemplo).
 */
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";

/** Onde esta landing é servida — usado em canonical, Open Graph e sitemap. */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";

export const links = {
  /** CTA principal — repetido 5 vezes na página, sempre para cá. */
  cadastroContratante: `${APP_ORIGIN}/cadastro/contratante`,
  /** CTA secundário — o profissional. */
  cadastroPrestador: `${APP_ORIGIN}/cadastro/prestador`,
  /**
   * Saída para quem já tem conta. Nunca é botão.
   *
   * `/login` também é o atalho de quem JÁ está logado: a tela redireciona a
   * sessão viva direto para a home do papel dela. Por isso a landing não
   * precisa checar sessão nenhuma para dar o caminho certo a quem volta.
   */
  login: `${APP_ORIGIN}/login`,
} as const;

/**
 * O texto do CTA é UM SÓ, nas cinco aparições. Variar quebra o reconhecimento
 * e inutiliza a métrica — por isso mora aqui, não solto em cada seção.
 */
export const CTA_LABEL = "Quero receber propostas";

/** As oito categorias em destaque — espelham `service_categories.featured`. */
export const CATEGORIAS = [
  { nome: "Eletricista", exemplo: "Tomada queimada, chuveiro, disjuntor caindo" },
  { nome: "Encanador", exemplo: "Vazamento, entupimento, caixa d'água" },
  { nome: "Marido de aluguel", exemplo: "Prateleira, suporte de TV, fechadura" },
  { nome: "Gesso e drywall", exemplo: "Forro, sanca, parede de divisória" },
  { nome: "Marcenaria", exemplo: "Móvel sob medida, porta, armário" },
  { nome: "Pintor", exemplo: "Quarto, fachada, textura" },
  { nome: "Pisos e revestimentos", exemplo: "Porcelanato, rejunte, azulejo" },
  { nome: "Pequenos reparos", exemplo: "Aquele conserto que ninguém quer pegar" },
] as const;
