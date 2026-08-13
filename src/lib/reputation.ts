/**
 * Reputação do prestador para exibição.
 * Um profissional NOVO (sem serviços concluídos) começa em 0★ e NÃO recebe o
 * Selo Fixly automaticamente — antes todo mundo nascia "5,0". Mostramos "Novo"
 * enquanto não houver avaliação, em vez de uma nota inflada.
 */
export function providerReputation(
  rating: number | null | undefined,
  jobsDone: number | null | undefined,
  /**
   * `profiles.seal_active` (0028). Quando vem do banco, MANDA — é ele que
   * carrega a revogação feita pela equipe (fraude, manipulação de avaliação,
   * dano grave). Sem esse valor, cai na regra automática, que continua valendo
   * para quem só quer mostrar a nota.
   */
  sealActive?: boolean | null,
) {
  const jobs = jobsDone ?? 0;
  const value = rating ?? 0;
  const isNew = jobs === 0;
  const automatico = !isNew && value >= 4.5;
  return {
    isNew,
    value,
    /** Texto pronto para exibir ("Novo" ou "4.8"). */
    label: isNew ? "Novo" : value.toFixed(1),
    /** Selo Fixly: 4,5★ ou mais, com histórico — e sem revogação. */
    elite: sealActive == null ? automatico : sealActive,
  };
}
