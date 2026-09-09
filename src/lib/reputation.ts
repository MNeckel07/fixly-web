/**
 * Reputação do prestador para exibição.
 * Um profissional NOVO (sem serviços concluídos) começa em 0★ e NÃO recebe o
 * Selo Fixly automaticamente — antes todo mundo nascia "5,0". Mostramos "Novo"
 * enquanto não houver avaliação, em vez de uma nota inflada.
 */
/**
 * REGRA DO SELO FIXLY (Fixly 13, pág. 7).
 *
 * *"Deixar o selo liberado só depois de 10 serviços e com a avaliação maior
 * que 4,5 estrelas"*.
 *
 * Antes bastava **um** serviço 5★: `!isNew && value >= 4.5`. O primeiro
 * cliente satisfeito já entregava o selo — que é o que o dono flagrou no
 * perfil do teste, com "Selo Fixly" ao lado de "3 serviços" (pág. 7). Um selo
 * que qualquer um consegue na primeira semana não separa ninguém de ninguém:
 * ele deixa de ser reputação e vira enfeite, e o cliente que filtra por
 * "Com Selo Fixly" continua sem saber com quem está falando.
 *
 * ⚠️ `> 4.5`, não `>= 4.5` — o dono escreveu "MAIOR que 4,5". A diferença é
 * real: com 10 serviços, uma média de exatamente 4,5 (por exemplo cinco 5★ e
 * cinco 4★) NÃO passa.
 *
 * Isto vale só para o selo AUTOMÁTICO. `seal_active` vindo do banco continua
 * mandando — é por ele que a equipe concede e revoga na mão (0028).
 */
export const SELO_MIN_SERVICOS = 10;
export const SELO_MIN_NOTA = 4.5;

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
  const automatico = jobs >= SELO_MIN_SERVICOS && value > SELO_MIN_NOTA;
  return {
    isNew,
    value,
    /** Texto pronto para exibir ("Novo" ou "4.8"). */
    label: isNew ? "Novo" : value.toFixed(1),
    /** Selo Fixly: ver `SELO_MIN_SERVICOS` / `SELO_MIN_NOTA` — e sem revogação. */
    elite: sealActive == null ? automatico : sealActive,
    /** Quantos serviços ainda faltam para o selo (0 = já bateu a meta). */
    faltamParaSelo: Math.max(SELO_MIN_SERVICOS - jobs, 0),
  };
}
