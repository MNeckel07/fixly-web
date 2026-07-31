/**
 * Catálogo auxiliar: quais categorias entram no atalho de reforma e o exemplo
 * de descrição de cada uma.
 *
 * O roteamento por texto livre ("descreva o que você precisa") saiu daqui —
 * agora é o motor de busca em `lib/serviceSearch.ts`, com léxico treinado,
 * casamento por frase, radical e erro de digitação. `routeCategory` continua
 * exportado abaixo por compatibilidade.
 */

/** Categorias associadas a reforma/obra (para o atalho "Quero reformar minha casa"). */
export const REFORMA_SLUGS = [
  "alvenaria", "carpintaria", "armador", "pisos", "gesso", "telhados", "esquadrias",
  "vidracaria", "marcenaria", "serralheria", "impermeabilizacao", "fachadas", "banheiros",
  "churrasqueiras", "gas", "pintor", "eletricista", "encanador", "faz_tudo",
  "marido_aluguel", "pequenos_reparos",
];

/** Exemplo de descrição por categoria (placeholder do campo "o que precisa"). */
const DESCRIPTION_EXAMPLES: Record<string, string> = {
  eletricista: "Ex.: Tomada da cozinha parou de funcionar e preciso resolver hoje.",
  encanador: "Ex.: Vazamento embaixo da pia do banheiro pingando há dois dias.",
  pintor: "Ex.: Pintar a sala e dois quartos, paredes já preparadas.",
  diarista: "Ex.: Limpeza completa de um apê de 2 quartos, uma vez por semana.",
  montador: "Ex.: Montar um guarda-roupa de 6 portas e uma cômoda.",
  ar_condicionado: "Ex.: Instalar um split de 12.000 BTUs no quarto.",
  jardinagem: "Ex.: Podar duas árvores e aparar a grama do quintal.",
  chaveiro: "Ex.: Troca da fechadura da porta de entrada.",
  alvenaria: "Ex.: Levantar um muro de 8 metros nos fundos.",
  carpintaria: "Ex.: Fazer as formas de madeira para uma laje pequena.",
  armador: "Ex.: Armar ferragem de pilares e vigas de uma obra pequena.",
  pisos: "Ex.: Assentar porcelanato em 30 m² de sala.",
  gesso: "Ex.: Forro de gesso com sanca na sala de estar.",
  telhados: "Ex.: Trocar telhas quebradas e revisar as calhas.",
  esquadrias: "Ex.: Instalar duas janelas de alumínio nos quartos.",
  vidracaria: "Ex.: Colocar um box de vidro no banheiro da suíte.",
  marcenaria: "Ex.: Armário planejado sob medida para a cozinha.",
  serralheria: "Ex.: Fabricar e instalar um portão de garagem.",
  impermeabilizacao: "Ex.: Impermeabilizar a laje que está com infiltração.",
  fachadas: "Ex.: Reforma e pintura da fachada do sobrado.",
  banheiros: "Ex.: Reforma completa de um banheiro de 4 m².",
  churrasqueiras: "Ex.: Construir uma churrasqueira de alvenaria na área.",
  gas: "Ex.: Instalar aquecedor a gás e a tubulação até a cozinha.",
  seguranca: "Ex.: Instalar 4 câmeras e um interfone na entrada.",
  redes_logica: "Ex.: Passar cabeamento de rede para o home office.",
  automacao: "Ex.: Automatizar iluminação e cortinas da sala.",
  faz_tudo: "Ex.: Pequenos reparos gerais pela casa (torneira, prateleira, quadro).",
  marido_aluguel: "Ex.: Furar a parede e instalar prateleiras e um varal.",
  pequenos_reparos: "Ex.: Trocar a resistência do chuveiro e apertar o registro.",
};

/** Placeholder da descrição conforme a categoria escolhida. */
export function descriptionExample(slug: string | null | undefined): string {
  return (slug && DESCRIPTION_EXAMPLES[slug]) || "Ex.: Descreva o que você precisa, com o máximo de detalhes.";
}

export { routeCategory } from "./serviceSearch";
