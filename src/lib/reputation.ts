/**
 * Reputação do prestador para exibição.
 * Um profissional NOVO (sem serviços concluídos) começa em 0★ e NÃO recebe o
 * Selo Fixly automaticamente — antes todo mundo nascia "5,0". Mostramos "Novo"
 * enquanto não houver avaliação, em vez de uma nota inflada.
 */
export function providerReputation(
  rating: number | null | undefined,
  jobsDone: number | null | undefined,
) {
  const jobs = jobsDone ?? 0;
  const value = rating ?? 0;
  const isNew = jobs === 0;
  return {
    isNew,
    value,
    /** Texto pronto para exibir ("Novo" ou "4.8"). */
    label: isNew ? "Novo" : value.toFixed(1),
    /** Selo Fixly: 4,5★ ou mais, e já com histórico. */
    elite: !isNew && value >= 4.5,
  };
}
