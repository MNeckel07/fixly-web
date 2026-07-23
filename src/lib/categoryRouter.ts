/**
 * Roteamento por palavras-chave: interpreta o texto livre do contratante
 * ("Não encontrou? descreva o que precisa") e sugere a categoria mais provável.
 * (Heurística — pode ser trocada por IA depois sem mudar a interface.)
 */
const KEYWORDS: Record<string, string[]> = {
  eletricista: ["eletric", "tomada", "disjuntor", "fio", "curto", "lampada", "lâmpada", "luz", "energia", "chuveiro"],
  encanador: ["vazament", "cano", "encanad", "torneira", "pia", "esgoto", "entupi", "ralo", "registro", "descarga", "água", "agua"],
  pintor: ["pint", "tinta", "parede", "textura", "verniz", "grafiato"],
  diarista: ["faxin", "limpez", "diarist", "passar roupa", "organizar"],
  montador: ["montar", "montagem", "móvel", "movel", "guarda-roupa", "estante"],
  ar_condicionado: ["ar condicionado", "ar-condicionado", "split", "refriger"],
  jardinagem: ["jardim", "grama", "poda", "planta", "paisag"],
  chaveiro: ["chave", "fechadura", "trava", "abrir porta", "cadeado"],
  alvenaria: ["tijolo", "muro", "pedreiro", "reboco", "alvenaria", "concreto"],
  carpintaria: ["carpint", "madeira", "forma de concreto"],
  pisos: ["piso", "porcelanato", "cerâmica", "ceramica", "azulejo", "revestiment", "rejunte", "laminado"],
  gesso: ["gesso", "drywall", "forro", "sanca"],
  telhados: ["telhado", "telha", "calha", "goteira"],
  esquadrias: ["esquadria", "janela", "porta de alumínio", "aluminio", "alumínio"],
  vidracaria: ["vidro", "box de banheiro", "espelho", "vidrac"],
  marcenaria: ["marcenaria", "planejado", "sob medida"],
  serralheria: ["serralh", "portão", "portao", "grade", "solda", "ferro"],
  impermeabilizacao: ["impermeab", "infiltra", "laje vazando"],
  fachadas: ["fachada", "pintura predial", "revestimento externo"],
  banheiros: ["banheiro", "reforma de banheiro"],
  churrasqueiras: ["churrasqueira", "forno de pizza"],
  gas: ["gás", "aquecedor", "instalação de gas", "botijão", "botijao"],
  seguranca: ["câmera", "camera", "cftv", "alarme", "segurança", "cerca elétrica", "interfone"],
  redes_logica: ["cabeament", "internet", "wifi", "wi-fi", "lógica", "cabo de rede"],
  automacao: ["automaç", "automac", "casa inteligente", "smart"],
  marido_aluguel: ["marido de aluguel", "reparo", "conserto", "instalar", "furar", "prateleira"],
};

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

export function routeCategory(text: string): { slug: string; matched: boolean } {
  const t = text.toLowerCase();
  let best: string | null = null;
  let score = 0;
  for (const [slug, kws] of Object.entries(KEYWORDS)) {
    const s = kws.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    if (s > score) {
      score = s;
      best = slug;
    }
  }
  return { slug: best ?? "faz_tudo", matched: score > 0 };
}
