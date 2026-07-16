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
