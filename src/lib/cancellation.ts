/**
 * POLÍTICA DE CANCELAMENTO — a conta, num lugar só
 * =================================================
 *
 * Espelha o texto escrito pelo dono (itens 3 a 8 da política). Ele foi
 * explícito: *"isso aí precisamos garantir bem do jeito que está escrito, se
 * não pode dar problemas"*. Por isso cada regra abaixo cita o item que a
 * origina, e a conta mora AQUI — em funções puras — e não espalhada por dentro
 * das telas e das server actions.
 *
 * Duas consequências práticas de ser função pura:
 *  1. a MESMA conta que o servidor executa é a que a tela mostra ANTES de o
 *     usuário confirmar. Cliente que descobre a retenção depois do clique é
 *     reclamação garantida — e, num cancelamento, é reclamação com razão;
 *  2. dá para conferir a regra sem banco, sem gateway e sem navegador.
 *
 * ⚠️ O QUE ESTE ARQUIVO NÃO DECIDE: o item 3.4 (cancelamento com a execução já
 * iniciada) depende de "etapa efetivamente executada, apurada mediante
 * evidências" — foto, medição, relatório. Isso é apuração humana, não fórmula.
 * A função devolve `apuracao: true` e o dinheiro fica RETIDO (item 8), em vez
 * de a plataforma inventar um número.
 */

/** Etapa em que o cancelamento aconteceu — é ela que define a conta. */
export type CancelStage =
  | "antes_do_aceite" // 3.1
  | "apos_aceite" // 3.2
  | "apos_deslocamento" // 3.3
  | "em_execucao" // 3.4 + 8
  | "no_show_cliente" // 5.1
  | "no_show_profissional"; // 5.2

/** Item 3.2 — reserva de agenda do profissional + custo operacional. */
export const RETENCAO_APOS_ACEITE = 0.3;
/** Item 3.3 — deslocamento verificado. */
export const RETENCAO_APOS_DESLOCAMENTO = 0.5;
/** Item 5.1 — tolerância antes de caracterizar a ausência do cliente. */
export const TOLERANCIA_NO_SHOW_MIN = 30;
/** Item 6 — janela de cancelamento gratuito do Express, em minutos. */
export const JANELA_GRATIS_EXPRESS_MIN = 5;

export type ServicoParaCancelar = {
  status: string;
  mode: string | null;
  urgent: boolean;
  /** Total cobrado do contratante (serviço + frete). */
  final_price: number | null;
  estimated_price: number | null;
  /** Taxa de deslocamento combinada na proposta. */
  travel_fee: number | null;
  created_at: string | null;
  accepted_at: string | null;
  departed_at: string | null;
  started_at: string | null;
  provider_id: string | null;
};

export type MotivoCancelamento = "desisti" | "no_show_profissional" | "no_show_cliente";

export type ContaCancelamento = {
  stage: CancelStage;
  /** Base da conta: o valor combinado do serviço, SEM o frete. */
  valorServico: number;
  frete: number;
  total: number;
  /** Quanto fica retido (vai para o profissional, descontada a comissão). */
  retido: number;
  /** Quanto volta para o contratante. */
  reembolso: number;
  /** Percentual aplicado, quando a regra é percentual (0 quando não é). */
  percentual: number;
  /** `true` quando a etapa exige apuração humana: nada é decidido sozinho. */
  apuracao: boolean;
  /** Frase curta que a tela mostra antes de confirmar. */
  resumo: string;
  /** Item da política que sustentou a decisão — vai para o log e para o suporte. */
  clausula: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Minutos entre duas datas (a segunda é "agora" por padrão). */
function minutosDesde(iso: string | null, agora: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (agora.getTime() - t) / 60_000;
}

/**
 * Em que etapa este serviço está, para efeito de cancelamento.
 *
 * A ordem das perguntas é do MAIS avançado para o menos: um serviço em execução
 * também já foi aceito, e responder "aceito" para ele cobraria 30% de quem já
 * tem o profissional dentro de casa.
 */
export function etapaDoCancelamento(
  s: ServicoParaCancelar,
  motivo: MotivoCancelamento = "desisti",
  agora: Date = new Date(),
): CancelStage {
  if (motivo === "no_show_profissional") return "no_show_profissional";
  if (motivo === "no_show_cliente") return "no_show_cliente";

  // Sem profissional designado não há a quem compensar (item 3.1).
  if (!s.provider_id) return "antes_do_aceite";

  if (s.started_at || s.status === "em_andamento") return "em_execucao";
  if (s.departed_at || s.status === "a_caminho") return "apos_deslocamento";

  /**
   * Item 6 — janela do Express. O texto do dono ("[5] minutos após a
   * solicitação") ENCURTA a janela por causa da urgência; aqui ela é aplicada
   * de forma a nunca cobrar de quem o texto não manda cobrar: dentro dos 5
   * minutos o cancelamento é gratuito mesmo que alguém já tenha aceitado.
   * ⚠️ Se o dono quiser o oposto (cobrar já a partir do 5º minuto, mesmo sem
   * aceite), é UMA linha aqui — mas é decisão dele, não interpretação nossa.
   */
  if (s.urgent && s.mode !== "orcamento") {
    const min = minutosDesde(s.created_at, agora);
    if (min != null && min <= JANELA_GRATIS_EXPRESS_MIN) return "antes_do_aceite";
  }

  /**
   * Item 6 — Reformas: grátis "até a aprovação do orçamento". No Fixly a
   * aprovação do orçamento É o aceite da proposta com valor, então um pedido de
   * orçamento sem `final_price` ainda está antes dela.
   */
  if (s.mode === "orcamento" && !s.final_price) return "antes_do_aceite";

  return "apos_aceite";
}

/**
 * A conta do cancelamento.
 *
 * `valorServico` é o total MENOS o frete de propósito: o item 3.3 manda comparar
 * "50% do valor do Serviço" com "o valor da taxa de deslocamento" e ficar com o
 * maior — comparação que não existe se o frete estiver escondido dentro do
 * preço.
 */
export function contaDoCancelamento(
  s: ServicoParaCancelar,
  motivo: MotivoCancelamento = "desisti",
  agora: Date = new Date(),
): ContaCancelamento {
  const stage = etapaDoCancelamento(s, motivo, agora);
  const total = Number(s.final_price ?? s.estimated_price ?? 0) || 0;
  const frete = Math.min(Number(s.travel_fee ?? 0) || 0, total);
  const valorServico = round2(total - frete);

  const base = { stage, valorServico, frete, total };

  switch (stage) {
    case "antes_do_aceite":
      return {
        ...base,
        retido: 0,
        reembolso: total,
        percentual: 0,
        apuracao: false,
        resumo:
          total > 0
            ? "Cancelamento gratuito: nenhum profissional aceitou ainda, então o valor pago volta integralmente."
            : "Cancelamento gratuito: nenhum profissional aceitou este pedido ainda.",
        clausula: "3.1 — cancelamento antes do aceite do profissional",
      };

    case "apos_aceite": {
      const retido = round2(valorServico * RETENCAO_APOS_ACEITE);
      return {
        ...base,
        retido,
        reembolso: round2(total - retido),
        percentual: RETENCAO_APOS_ACEITE,
        apuracao: false,
        resumo: `O profissional já aceitou e reservou a agenda: fica retido 30% do valor do serviço. Você recebe de volta o restante.`,
        clausula: "3.2 — após o aceite e antes do deslocamento",
      };
    }

    case "apos_deslocamento": {
      // "50% do valor do Serviço OU a taxa de deslocamento, o que for MAIOR"
      const meio = round2(valorServico * RETENCAO_APOS_DESLOCAMENTO);
      const retido = Math.min(round2(Math.max(meio, frete)), total);
      return {
        ...base,
        retido,
        reembolso: round2(total - retido),
        percentual: RETENCAO_APOS_DESLOCAMENTO,
        apuracao: false,
        resumo:
          frete > meio
            ? "O profissional já saiu para o local: fica retida a taxa de deslocamento, por ser maior que os 50% do serviço."
            : "O profissional já saiu para o local: fica retido 50% do valor do serviço.",
        clausula: "3.3 — após o deslocamento e antes do início da execução",
      };
    }

    case "em_execucao":
      return {
        ...base,
        retido: total,
        reembolso: 0,
        percentual: 0,
        apuracao: true,
        resumo:
          "O serviço já começou. Pela política, é devido ao profissional o valor da etapa executada e dos materiais já comprados — o que depende das evidências registradas (fotos, medições, relatório). O valor fica retido enquanto o suporte apura.",
        clausula: "3.4 — após o início da execução (com o item 8: valor retido durante a apuração)",
      };

    case "no_show_cliente": {
      const retido = Math.min(frete, total);
      return {
        ...base,
        retido,
        reembolso: round2(total - retido),
        percentual: 0,
        apuracao: false,
        resumo: `Cliente ausente após ${TOLERANCIA_NO_SHOW_MIN} minutos de tolerância e tentativa de contato: é devida ao profissional a taxa de deslocamento; o restante volta para o cliente.`,
        clausula: "5.1 — não comparecimento do cliente",
      };
    }

    case "no_show_profissional":
      return {
        ...base,
        retido: 0,
        reembolso: total,
        percentual: 0,
        apuracao: false,
        resumo:
          "Profissional ausente: reembolso integral e prioridade no reagendamento, sem custo adicional para você.",
        clausula: "5.2 — não comparecimento do profissional",
      };
  }
}

/**
 * Item 7 — prazo do reembolso, pelo MEIO usado na contratação.
 *
 * Escrito na tela na hora do cancelamento porque a reclamação clássica não é a
 * retenção, é "cadê meu dinheiro": no cartão o estorno pode levar duas faturas,
 * e quem não foi avisado disso abre chamado no terceiro dia.
 */
export function prazoDoReembolso(method: string | null | undefined): string {
  switch (method) {
    case "pix":
      return "até 30 dias úteis da aprovação (Pix)";
    case "cartao":
      return "conforme o ciclo da administradora — o estorno pode aparecer em até 2 faturas";
    case "apple_pay":
    case "google_pay":
      return "conforme o ciclo do cartão cadastrado na carteira — em até 2 faturas";
    case "boleto":
    case "debito":
      return "até 30 dias úteis, após a confirmação dos seus dados bancários";
    default:
      return "pelo mesmo meio usado na contratação, nos prazos da política";
  }
}
