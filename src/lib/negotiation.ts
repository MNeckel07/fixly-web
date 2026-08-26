/**
 * NEGOCIAÇÃO COM FIM — as regras que as duas telas precisam saber
 * ================================================================
 *
 * O relato: *"as propostas tão infinitas"*. A regra pedida: *"fiz a proposta,
 * volta uma contra, faço outra, e no máx volta mais uma pro contratante
 * aceitar; a última é o prestador que dá. Tem que ter duas voltas de valor,
 * dois blocos de propostas."*
 *
 * Em rodadas de CONTRA-PROPOSTA (a proposta original não conta):
 *
 * ```
 *   proposta do profissional        →  valor 0   (não é rodada)
 *   1ª contra do contratante        →  rodada 1  ┐ 1º bloco
 *   resposta do profissional        →  rodada 2  ┘
 *   2ª contra do contratante        →  rodada 3  ┐ 2º bloco
 *   valor FINAL do profissional     →  rodada 4  ┘
 *   contratante: aceita ou recusa   →  fim
 * ```
 *
 * ⚠️ Quem realmente segura o limite é o banco (`counter_proposal`, migração
 * 0036): validação de tela é conveniência, não regra. O que mora aqui existe
 * para as telas **pararem de oferecer** o botão quando não há mais rodada — um
 * limite que só aparece como erro depois do clique é pior do que não ter limite.
 */

/** Total de valores novos que a negociação aceita depois da proposta inicial. */
export const MAX_RODADAS_NEGOCIACAO = 4;

/** De quem é a próxima contra-proposta (ímpar = contratante, par = profissional). */
export function vezDe(rodadasFeitas: number): "contratante" | "profissional" | null {
  const prox = rodadasFeitas + 1;
  if (prox > MAX_RODADAS_NEGOCIACAO) return null;
  return prox % 2 === 1 ? "contratante" : "profissional";
}

/** Quantos valores novos ainda cabem. */
export function rodadasRestantes(rodadasFeitas: number): number {
  return Math.max(MAX_RODADAS_NEGOCIACAO - rodadasFeitas, 0);
}

/** Texto curto para a tela — o mesmo dos dois lados. */
export function rotuloDaNegociacao(rodadasFeitas: number): string {
  const restam = rodadasRestantes(rodadasFeitas);
  if (restam === 0) return "Último valor dado — aceite ou recuse.";
  const bloco = Math.floor(rodadasFeitas / 2) + 1;
  return `Negociação: bloco ${bloco} de 2 · ${restam} valor(es) restante(s)`;
}
