/**
 * MOTOR DE BUSCA DE SERVIÇOS DO FIXLY
 * ===================================
 *
 * Interpreta o texto livre do contratante ("quero trocar o piso do meu
 * banheiro") e devolve as categorias mais prováveis, ranqueadas.
 *
 * É uma IA *própria e gratuita*: em vez de chamar um modelo de terceiros
 * (que custa, tem chave, cota e latência), o "treino" está no LÉXICO curado
 * abaixo — sinônimos, gírias e erros de digitação do vocabulário de obra e
 * manutenção no Brasil. Roda no servidor, sem dependência externa, em
 * milissegundos, e é determinístico (o mesmo texto sempre dá o mesmo
 * resultado, o que permite corrigir um caso específico sem quebrar os outros).
 *
 * Como pontua, em ordem de força:
 *   1. FRASE            — "caixa de gordura", "box de banheiro"  → peso × 3.2
 *   2. PALAVRA EXATA    — "vazamento", "piso"                    → peso × 2.0
 *   3. RADICAL/PREFIXO  — "impermeabiliza" ≈ "impermeabilizante" → peso × 1.3
 *   4. ERRO DE DIGITAÇÃO— "eletrecista" ≈ "eletricista"          → peso × 0.7
 *
 * Regras que vieram de erros reais em produção:
 *   • categoria OCULTA nunca é resultado — é redirecionada (REDIRECT abaixo).
 *     Era o bug de "trocar o piso do banheiro" cair em Banheiros (oculta) e a
 *     tela mostrar "Encontramos: profissional";
 *   • o texto livre do prestador (`specialties`) também é pesquisado, para
 *     achar quem faz algo que não é categoria (ex.: "piscina").
 */

/* ─────────────────────────── normalização ─────────────────────────── */

/** minúsculas, sem acento, sem pontuação. */
export function normalize(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras que não ajudam a decidir a categoria. */
const STOPWORDS = new Set([
  "a","ao","aos","as","com","da","das","de","do","dos","e","em","essa","esse","esta","estao",
  "estou","eu","ha","isso","ja","la","mais","me","meu","meus","minha","minhas","muito","na",
  "nao","nas","no","nos","num","numa","o","os","ou","para","pela","pelo","por","pra","pro",
  "que","se","sem","ser","seu","sua","tem","ter","um","uma","uns","umas","vou","aqui","ali",
  "ta","tao","to","preciso","precisa","quero","queria","gostaria","fazer","faz","favor",
  "alguem","alguma","algum","urgente","hoje","amanha","agora","casa","apartamento","ap",
  "apto","dia","tudo","todo","toda","bem","mal","pouco","tipo","como","onde","qual","quanto",
  "sobre","ate","apenas","so","tambem","mas","porque","pois","entao","depois","antes",
]);

/**
 * Verbos genéricos: sinalizam serviço, mas não *qual* — peso mínimo.
 * (`pintar`, `limpar` e `montar` NÃO entram aqui: cada um aponta uma categoria.)
 */
const WEAK_VERBS = new Set([
  "trocar","troca","instalar","instalacao","consertar","conserto","arrumar","reparar","reparo",
  "colocar","revisar","revisao","fazer","refazer","construir",
  "reformar","reforma","cortar","tirar","mudar","ajustar","resolver","concertar",
]);

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/* ─────────────────────────── léxico treinado ─────────────────────────── */

/**
 * Termos por categoria com peso (1–10). Frases (com espaço) valem mais.
 * Peso 9–10 = decisivo; 5–8 = forte; 2–4 = indício.
 */
type Lexicon = Record<string, Record<string, number>>;

const LEXICON: Lexicon = {
  eletricista: {
    "quadro de energia": 10, "quadro de luz": 10, "curto circuito": 10, "chuveiro eletrico": 9,
    "resistencia do chuveiro": 9, "fiacao": 8, "padrao de entrada": 9, "aterramento": 9,
    eletricista: 10, eletrica: 8, eletrico: 7, tomada: 8, disjuntor: 9, interruptor: 8,
    fio: 6, fios: 6, curto: 6, lampada: 7, luminaria: 7, luz: 4, energia: 5, choque: 6,
    chuveiro: 5, ventilador: 5, lustre: 6, spot: 5, tomadas: 8, voltagem: 7, "110": 3, "220": 3,
    eletrecista: 8, eletrisista: 8,
  },
  encanador: {
    "caixa de gordura": 10, "vaso sanitario": 10, "caixa d agua": 9, "caixa de agua": 9,
    "pia entupida": 10, "ralo entupido": 10, "descarga nao funciona": 9, "bomba d agua": 8,
    encanador: 10, bombeiro: 5, hidraulica: 9, hidraulico: 8, vazamento: 10, vazando: 9,
    cano: 8, canos: 8, tubulacao: 8, torneira: 8, pia: 7, esgoto: 9, entupido: 9, entupimento: 9,
    entupida: 9, ralo: 7, registro: 6, descarga: 8, sifao: 8, privada: 8, chuveirinho: 6,
    agua: 4, gotejando: 7, pingando: 7, bacia: 6, encanamento: 9, incanador: 8,
  },
  pintor: {
    "pintura interna": 9, "pintura de parede": 9, "massa corrida": 9, "textura na parede": 9,
    pintor: 10, pintura: 9, pintar: 9, tinta: 8, pintado: 6, latex: 8, esmalte: 7, verniz: 7,
    grafiato: 9, textura: 6, selador: 8, massa: 5, parede: 4, paredes: 4, repintar: 8,
    branquear: 5, rolo: 3,
  },
  diarista: {
    "limpeza pesada": 9, "faxina completa": 10, "passar roupa": 9, "limpeza pos obra": 9,
    diarista: 10, faxina: 10, faxineira: 10, limpeza: 6, empregada: 8, domestica: 8,
    organizar: 5, organizacao: 5, lavar: 5, arrumadeira: 8, cozinhar: 5,
  },
  montador: {
    "guarda roupa": 8, "montar movel": 10, "montagem de moveis": 10, "cama box": 7,
    montador: 10, montagem: 8, montar: 6, movel: 7, moveis: 7, estante: 8, comoda: 8,
    berco: 7, escrivaninha: 8, armario: 5, desmontar: 7, painel: 5, rack: 7,
  },
  ar_condicionado: {
    "ar condicionado": 10, "carga de gas": 8, "higienizacao do ar": 9, "split inverter": 9,
    climatizacao: 9, refrigeracao: 9, split: 9, condicionado: 9, condensadora: 9,
    evaporadora: 9, btus: 8, btu: 8, gelando: 7, "ar": 3, condicionador: 8, arcondicionado: 9,
  },
  jardinagem: {
    "cortar a grama": 10, "poda de arvore": 10, "paisagismo": 9, "grama sintetica": 7,
    jardineiro: 10, jardinagem: 10, jardim: 9, grama: 9, gramado: 9, poda: 9, podar: 9,
    arvore: 8, arvores: 8, planta: 6, plantas: 6, canteiro: 7, mato: 7, cerca_viva: 7,
    horta: 7, adubo: 5, roçar: 7, rocar: 7,
  },
  chaveiro: {
    "abrir porta": 9, "troca de segredo": 10, "chave quebrou": 10, "chave codificada": 9,
    chaveiro: 10, chave: 8, chaves: 8, fechadura: 10, trava: 7, tranca: 8, cadeado: 8,
    trancado: 8, cilindro: 7, segredo: 6, copia: 5, maçaneta: 7, macaneta: 7,
  },
  alvenaria: {
    "levantar muro": 10, "assentar tijolo": 10, "quebrar parede": 9, "abrir parede": 8,
    "contrapiso": 9, "laje de concreto": 9, "parede de tijolo": 9,
    pedreiro: 10, alvenaria: 10, muro: 10, murinho: 10, reboco: 10, rebocar: 10,
    tijolo: 9, tijolos: 9, bloco: 7, concreto: 8, cimento: 7, argamassa: 8, chapisco: 9,
    emboco: 9, laje: 7, coluna: 6, viga: 6, pilar: 6, obra: 4, escada: 5, calcada: 7,
    padreiro: 9,
  },
  carpintaria: {
    "forma de concreto": 10, "estrutura de madeira": 9, "telhado de madeira": 7,
    carpinteiro: 10, carpintaria: 10, madeira: 7, madeiramento: 9, caibro: 8, viga_madeira: 8,
    tesoura: 6, forma: 5, formas: 5, pergolado: 8, deck: 8,
  },
  armador: {
    "ferragem da laje": 10, "armar ferragem": 10, "aco estrutural": 9,
    armador: 10, ferragem: 9, ferragens: 9, armadura: 8, estribo: 9, aco: 6,
    dobrar_ferro: 8, vergalhao: 9, treliça: 8, trelica: 8,
  },
  pisos: {
    "trocar o piso": 10, "assentar piso": 10, "colocar piso": 10, "piso vinilico": 10,
    "piso laminado": 10, "rejunte do piso": 9, "revestimento de parede": 8, "porcelanato liquido": 9,
    piso: 10, pisos: 10, porcelanato: 10, ceramica: 9, azulejo: 9, azulejos: 9,
    revestimento: 8, rejunte: 9, rejuntamento: 9, laminado: 9, vinilico: 9, taco: 7,
    assentamento: 8, ladrilho: 9, pastilha: 8, nivelamento: 6, soleira: 7, rodape: 7,
    porcelanado: 9, pizo: 9,
  },
  gesso: {
    "forro de gesso": 10, "gesso acartonado": 10, "sanca aberta": 9, "parede de drywall": 10,
    gesseiro: 10, gesso: 10, drywall: 10, forro: 9, sanca: 10, moldura: 6, placa: 5,
    acartonado: 9, "pvc": 4, dry_wall: 9,
  },
  telhados: {
    "trocar telha": 10, "telhado vazando": 10, "limpeza de calha": 9, "manta termica": 8,
    telhado: 10, telha: 10, telhas: 10, calha: 9, calhas: 9, goteira: 10, rufo: 9,
    telhadista: 10, cumeeira: 9, beiral: 8, infiltracao_telhado: 8, coberta: 6, cobertura: 6,
    telado: 9,
  },
  esquadrias: {
    "porta de aluminio": 10, "janela de aluminio": 10, "esquadria de aluminio": 10,
    "porta de correr": 8, "janela emperrada": 8,
    esquadria: 10, esquadrias: 10, aluminio: 8, janela: 8, janelas: 8, porta: 6, portas: 6,
    veneziana: 9, batente: 7, persiana: 7, guilhotina: 7, maxim_ar: 8,
  },
  vidracaria: {
    "box de banheiro": 10, "box do banheiro": 10, "vidro temperado": 10, "espelho na parede": 9,
    "porta de vidro": 9, "janela de vidro": 8,
    vidraceiro: 10, vidracaria: 10, vidro: 9, vidros: 9, box: 9, espelho: 9, espelhos: 9,
    temperado: 8, blindex: 10, guarda_corpo: 8, vidraça: 9, vidraca: 9, vidrasaria: 9,
  },
  marcenaria: {
    "movel planejado": 10, "armario planejado": 10, "sob medida": 9, "armario de cozinha": 9,
    "guarda roupa planejado": 10, "closet": 8,
    marceneiro: 10, marcenaria: 10, planejado: 9, planejados: 9, mdf: 9, sobmedida: 9,
    "guarda roupa": 8, cozinha_planejada: 9, bancada: 6, gaveta: 6, marsenaria: 9,
  },
  serralheria: {
    "portao de garagem": 10, "portao automatico": 9, "grade de protecao": 9, "corrimao de ferro": 9,
    serralheiro: 10, serralheria: 10, portao: 10, portoes: 10, grade: 9, grades: 9,
    solda: 9, soldar: 9, ferro: 8, metalon: 9, corrimao: 8, guarda_corpo_ferro: 8,
    estrutura_metalica: 8, portaum: 9, seralheria: 9,
  },
  impermeabilizacao: {
    "laje vazando": 10, "parede com mofo": 8, "impermeabilizar a laje": 10,
    "manta asfaltica": 10, "infiltracao na parede": 10, "umidade na parede": 9,
    impermeabilizacao: 10, impermeabilizar: 10, impermeabilizante: 10, infiltracao: 10,
    infiltrando: 10, umidade: 8, mofo: 8, bolor: 7, manta: 8, mancha_umidade: 8,
    vedacao: 7, impermiabilizacao: 9,
  },
  fachadas: {
    "pintura predial": 10, "revestimento externo": 9, "lavagem de fachada": 9,
    "pintura de predio": 10,
    fachada: 10, fachadas: 10, predial: 9, predio: 7, externo: 5, "muro externo": 6,
    rapel: 8, alpinismo: 7,
  },
  churrasqueiras: {
    "forno de pizza": 10, "churrasqueira de alvenaria": 10, "area gourmet": 9,
    churrasqueira: 10, churrasqueiras: 10, churrasco: 7, forno: 7, defumador: 7,
    coifa: 6, gourmet: 6, xurrasqueira: 9,
  },
  gas: {
    "instalacao de gas": 10, "aquecedor a gas": 10, "tubulacao de gas": 10, "central de gas": 10,
    "cheiro de gas": 10, "botijao de gas": 9,
    gas: 9, aquecedor: 9, botijao: 8, glp: 9, gasista: 10, boiler: 8, "cooktop": 6,
    fogao: 6, registro_gas: 8, mangueira_gas: 8,
  },
  seguranca: {
    "camera de seguranca": 10, "cerca eletrica": 10, "portao eletronico": 9, "alarme residencial": 10,
    "circuito fechado": 9, "fechadura digital": 9,
    camera: 9, cameras: 9, cftv: 10, alarme: 9, seguranca: 8, monitoramento: 9,
    interfone: 9, videoporteiro: 9, sensor: 7, concertina: 9, dvr: 9, nvr: 8,
    "cerca": 6, biometria: 8, camara: 8,
  },
  redes_logica: {
    "cabo de rede": 10, "rede de internet": 9, "wifi nao pega": 9, "ponto de rede": 10,
    "cabeamento estruturado": 10, "rack de rede": 9,
    cabeamento: 10, rede: 7, redes: 7, internet: 8, wifi: 9, roteador: 9, switch: 8,
    "rj45": 9, fibra: 8, repetidor: 8, "logica": 7, patch: 7, ethernet: 9, wi: 4,
  },
  automacao: {
    "casa inteligente": 10, "automacao residencial": 10, "cortina automatica": 9,
    "iluminacao inteligente": 9, "assistente de voz": 8,
    automacao: 10, automatizar: 9, "smart": 8, alexa: 8, domotica: 10, cena: 5,
    "google home": 8, inteligente: 6,
  },
  marido_aluguel: {
    "marido de aluguel": 10, "pequenos reparos": 10, "furar a parede": 9, "instalar prateleira": 9,
    "pendurar quadro": 9, "instalar tv na parede": 9, "trocar a resistencia": 8,
    "manutencao geral": 8, "servicos gerais": 8,
    marido: 8, prateleira: 8, prateleiras: 8, quadro: 6, suporte: 6, varal: 8,
    furar: 8, furo: 7, buchas: 7, parafusar: 7, pendurar: 8, "tv": 4, cortina: 6,
    espelho_fixar: 5, "faz tudo": 9, faztudo: 9, reparinho: 8, biscate: 7,
  },
  pequenos_reparos: {
    "pequeno reparo": 10, "reparo rapido": 9, "manutencao pequena": 8,
    reparo: 6, reparos: 6, consertos: 6, ajuste: 5, retoque: 6,
  },
  /**
   * Frete e carreto (0037). O dono descreveu o caso em duas frases —
   * "preciso levar este armário para outra casa", "preciso levar esta cama
   * para outro lugar" —, então o que decide aqui é o VERBO DE TRANSPORTE
   * junto do móvel, não o móvel sozinho: "montar o armário" é montador e
   * "levar o armário" é frete.
   *
   * Por isso `armario`, `cama` e `sofa` NÃO entram nesta lista: eles já
   * pertencem ao montador, e repetir o termo aqui com peso alto roubaria
   * dele toda montagem de móvel. Quem carrega o pedido para cá são
   * "mudanca", "carreto", "transportar", "levar".
   */
  frete: {
    "mudanca de casa": 10, "frete de mudanca": 10, "levar movel": 9,
    "transportar movel": 9, "buscar movel": 8, "tirar entulho": 8,
    frete: 10, carreto: 10, mudanca: 9, transporte: 8, transportar: 8,
    caminhao: 7, caminhonete: 7, entrega: 6, carregar: 6, levar: 5,
    entulho: 7, descarte: 6, bagulho: 5, motorista: 5, "van": 5,
  },
};

/**
 * Categorias que NÃO podem ser resultado (estão `hidden` no catálogo).
 * Em vez de sumir, o termo empurra para as categorias que realmente resolvem.
 * (Foi o que causava "Encontramos: profissional" na tela do dono.)
 */
const REDIRECT: Record<string, string[]> = {
  banheiros: ["pisos", "encanador", "vidracaria"],
  faz_tudo: ["marido_aluguel"],
};

/** Termos de ambientes: sozinhos não decidem, mas reforçam candidatos. */
const ROOM_HINTS: Record<string, string[]> = {
  banheiro: ["pisos", "encanador", "vidracaria"],
  banheiros: ["pisos", "encanador", "vidracaria"],
  cozinha: ["marcenaria", "encanador", "pisos"],
  quarto: ["marcenaria", "pintor", "ar_condicionado"],
  sala: ["pintor", "pisos", "gesso"],
  quintal: ["jardinagem", "alvenaria"],
  garagem: ["serralheria", "pisos"],
  telhado: ["telhados", "impermeabilizacao"],
  laje: ["impermeabilizacao", "alvenaria"],
  varanda: ["pisos", "vidracaria"],
  piscina: [], // não temos categoria — cai na busca por especialidade do prestador
};

/* ─────────────────────── casamento aproximado ─────────────────────── */

/** Levenshtein com corte (para de contar quando passa de `max`). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Tolerância de digitação conforme o tamanho da palavra. Conservadora de
 * propósito: com 2 erros em 8 letras, "banheiro" casava com "canteiro" e a
 * busca mandava reforma de banheiro para Jardinagem.
 */
function typoBudget(len: number): number {
  if (len >= 10) return 2;
  if (len >= 6) return 1;
  return 0;
}

/* ─────────────────────────── busca ─────────────────────────── */

export interface SearchHit {
  slug: string;
  score: number;
  /** Termos do texto do usuário que casaram (para explicar o resultado). */
  matched: string[];
}

export interface SearchOptions {
  /** Slugs disponíveis (o catálogo visível). Resultados fora daqui são descartados. */
  available?: string[];
  /** Quantos resultados retornar. */
  limit?: number;
}

/**
 * Ranqueia as categorias para um texto livre.
 * Retorna [] quando nada casou (aí o chamador oferece a busca por profissional).
 */
export function searchCategories(text: string, opts: SearchOptions = {}): SearchHit[] {
  const norm = normalize(text);
  if (!norm) return [];
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const available = opts.available;
  const scores = new Map<string, number>();
  const matches = new Map<string, Set<string>>();

  const add = (slug: string, points: number, term: string) => {
    // categoria oculta empurra para quem resolve de verdade
    const targets = REDIRECT[slug] ?? [slug];
    const share = targets.length > 1 ? 1 : 1;
    for (const [i, target] of targets.entries()) {
      const decay = i === 0 ? share : share * 0.6; // o 1º redirecionado pesa mais
      scores.set(target, (scores.get(target) ?? 0) + points * decay);
      if (!matches.has(target)) matches.set(target, new Set());
      matches.get(target)!.add(term);
    }
  };

  for (const [slug, terms] of Object.entries(LEXICON)) {
    for (const [rawTerm, weight] of Object.entries(terms)) {
      const term = normalize(rawTerm.replace(/_/g, " "));
      if (!term) continue;

      // 1) frase inteira no texto
      if (term.includes(" ")) {
        if (norm.includes(term)) add(slug, weight * 3.2, term);
        continue;
      }

      // 2/3/4) palavra por palavra
      let best = 0;
      let bestTok = "";
      for (const tok of tokens) {
        const weak = WEAK_VERBS.has(tok) ? 0.35 : 1;
        let factor = 0;
        if (tok === term) factor = 2.0;
        else if (term.length >= 4 && tok.length >= 4 && (tok.startsWith(term) || term.startsWith(tok)))
          factor = 1.3;
        else {
          const budget = typoBudget(Math.max(term.length, tok.length));
          if (budget > 0 && editDistance(tok, term, budget) <= budget) factor = 0.7;
        }
        const points = weight * factor * weak;
        if (points > best) { best = points; bestTok = tok; }
      }
      if (best > 0) add(slug, best, bestTok);
    }
  }

  // Ambiente citado ("...do meu banheiro"): reforça o candidato que já pontuou
  // e, se NADA pontuou, semeia os serviços que costumam resolver naquele lugar
  // (senão "reforma de banheiro" não devolvia nada de útil).
  for (const tok of tokens) {
    const hints = ROOM_HINTS[tok];
    if (!hints) continue;
    for (const [i, target] of hints.entries()) {
      const already = scores.get(target);
      if (already) scores.set(target, already + 2.5);
      else if (!available || available.includes(target)) {
        scores.set(target, 6 - i); // semente: entra no ranking, sem "confiança"
        if (!matches.has(target)) matches.set(target, new Set());
        matches.get(target)!.add(tok);
      }
    }
  }

  return [...scores.entries()]
    .filter(([slug]) => !REDIRECT[slug])
    .filter(([slug]) => !available || available.includes(slug))
    .map(([slug, score]) => ({
      slug,
      score: Math.round(score * 10) / 10,
      matched: [...(matches.get(slug) ?? [])],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 4);
}

/** Confiança de que o 1º resultado é "o" serviço (para o texto da tela). */
export function isConfident(hits: SearchHit[]): boolean {
  if (hits.length === 0) return false;
  if (hits[0].score < 12) return false;
  if (hits.length === 1) return true;
  return hits[0].score >= hits[1].score * 1.35;
}

/**
 * Termos "de conteúdo" do texto — usados para procurar no texto livre do
 * prestador (`specialties`/`bio`/`headline`), onde estão os serviços que não
 * são categoria (ex.: "tratamento de piscina", "painel solar").
 */
export function contentTerms(text: string): string[] {
  return tokenize(text)
    .filter((t) => !WEAK_VERBS.has(t) && t.length >= 4)
    .slice(0, 6);
}

/** Compatibilidade com a interface antiga (`routeCategory`). */
export function routeCategory(text: string, available?: string[]): { slug: string; matched: boolean } {
  const hits = searchCategories(text, { available, limit: 1 });
  if (hits.length === 0) return { slug: "marido_aluguel", matched: false };
  return { slug: hits[0].slug, matched: true };
}
