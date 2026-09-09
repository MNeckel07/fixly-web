/**
 * FUSO HORÁRIO — o dia do usuário, não o dia do servidor
 * ======================================================
 *
 * 🔴 O BUG QUE ORIGINOU ESTE ARQUIVO (Fixly 13, pág. 8):
 *
 *     "só fiz serviços hoje no teste e deu que fiz hoje e amanhã, dia 02 e 03"
 *
 * O gráfico de "Ganhos na semana" fazia `new Date(created_at).getDay()`. Esse
 * `getDay()` responde no fuso de QUEM ESTÁ PERGUNTANDO — e quem pergunta é o
 * servidor do Render, que roda em **UTC**. O Brasil está 3 horas atrás:
 *
 *     serviço às 21:30 de 02/09 em Curitiba  →  00:30 de 03/09 em UTC
 *
 * Ou seja, todo serviço feito **depois das 21h** era contado no dia seguinte.
 * Um dia de trabalho aparecia partido em dois, e o dono viu ganho num dia em
 * que ainda não tinha trabalhado. Nada disso dá erro: a conta está certa, a
 * pergunta é que estava errada.
 *
 * ⚠️ NÃO CONSERTE ISSO SOMANDO 3 HORAS. O Brasil já teve horário de verão e
 * pode ter de novo; um `-3` fixo volta a errar no dia em que voltar. Quem sabe
 * a regra é o banco de fusos do sistema, via `Intl` — é o que este arquivo usa.
 */

export const FUSO_BR = "America/Sao_Paulo";

/**
 * Partes da data no fuso do Brasil. `Intl` com `en-CA` devolve ISO
 * (`2026-09-02`) sem precisar remontar string na mão.
 */
function partesBR(d: Date): { ymd: string; ano: number; mes: number; dia: number } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [ano, mes, dia] = ymd.split("-").map(Number);
  return { ymd, ano, mes, dia };
}

/** "2026-09-02" — o dia civil brasileiro de um instante qualquer. */
export function diaBR(data: Date | string): string {
  return partesBR(typeof data === "string" ? new Date(data) : data).ymd;
}

/**
 * Dia da semana no Brasil: 0 = domingo … 6 = sábado.
 *
 * O truque do `Date.UTC` com as partes JÁ convertidas monta uma data cujo
 * dia-da-semana é o brasileiro, sem depender do fuso do processo.
 */
export function diaDaSemanaBR(data: Date | string): number {
  const { ano, mes, dia } = partesBR(typeof data === "string" ? new Date(data) : data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/**
 * A semana corrente (domingo a sábado) no calendário brasileiro, como lista de
 * dias `YYYY-MM-DD`.
 *
 * Serve para o gráfico responder "esta semana" de verdade. Antes ele somava o
 * HISTÓRICO INTEIRO por dia da semana: uma quarta-feira de julho engordava a
 * barra da quarta de hoje, e o rótulo "Ganhos na semana" descrevia outra coisa.
 */
export function semanaAtualBR(agora: Date = new Date()): string[] {
  const { ano, mes, dia } = partesBR(agora);
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));
  const domingo = new Date(hoje);
  domingo.setUTCDate(hoje.getUTCDate() - hoje.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(domingo);
    d.setUTCDate(domingo.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** "02/09" — rótulo curto de um dia `YYYY-MM-DD` (sem passar por `Date`). */
export function rotuloDiaCurto(ymd: string): string {
  const [, mes, dia] = ymd.split("-");
  return `${dia}/${mes}`;
}
