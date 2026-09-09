-- ============================================================
--  0040 — SELO FIXLY: 10 serviços e nota MAIOR que 4,5
--
--  Pedido do dono (Fixly 13, pág. 7): *"Deixar o selo liberado só depois de 10
--  serviços e com a avaliação maior que 4,5 estrelas"*. Na mesma página, a
--  prova do problema: o perfil do teste exibindo "Selo Fixly" ao lado de
--  "3 serviços".
--
--  A regra da 0028 era `jobs > 0 and rating >= 4.5` — ou seja, UM único
--  cliente satisfeito bastava. Um selo que se ganha na primeira semana não
--  separa ninguém: o filtro "Com Selo Fixly" da tela de propostas passa a
--  devolver todo mundo, e o cliente que confiou nele fica sem informação
--  nenhuma.
--
--  ⚠️ QUEM MANDA É ESTA FUNÇÃO, NÃO A TELA. `lib/reputation.ts` também tem a
--  conta, mas quase toda tela lê `profiles.seal_active` (que vem daqui) e usa
--  o cálculo local só como reserva. Mudar apenas o TypeScript deixaria o selo
--  aparecendo do mesmo jeito, agora com os dois lados discordando.
--
--  ⚠️ `> 4.5`, não `>= 4.5`: o dono escreveu "MAIOR que 4,5". Com 10 serviços
--  isso é uma diferença real — média exatamente 4,5 (cinco 5★ + cinco 4★) não
--  passa.
-- ============================================================

create or replace function public.fixly_merece_selo(
  p_rating numeric, p_jobs int, p_revogado timestamptz
) returns boolean language sql immutable as $$
  select p_revogado is null
     and coalesce(p_jobs, 0) >= 10
     and coalesce(p_rating, 0) > 4.5;
$$;

comment on column public.profiles.seal_active is
  'Selo Fixly ATIVO. Calculado por trigger (10+ serviços e nota > 4,5) e derrubado por revogação do admin.';

-- ════════════════════════════════════════════════════════════
--  REAVALIA QUEM JÁ TEM O SELO
--
--  Sem isto, a regra nova valeria só para quem mudar de nota daqui para
--  frente: o trigger `fixly_sync_selo` roda em `update of rating, jobs_done,
--  ...`, então um perfil parado com 3 serviços ficaria com o selo para sempre
--  — exatamente o da pág. 7.
--
--  ⚠️ `guard_bypass` é obrigatório: a 0035 fechou `seal_active` para escrita
--  fora do trigger, e sem o bypass este update é recusado pelo guard.
-- ════════════════════════════════════════════════════════════
do $$
begin
  perform set_config('fixly.guard_bypass', 'on', true);

  update public.profiles p
     set seal_active = public.fixly_merece_selo(p.rating, p.jobs_done, p.seal_revoked_at),
         seal_changed_at = now()
   where p.role = 'prestador'
     and p.seal_active is distinct from public.fixly_merece_selo(p.rating, p.jobs_done, p.seal_revoked_at);

  /**
   * O e-mail de "você perdeu o selo" NÃO sai desta migração.
   *
   * Quem perde agora não fez nada de errado: a régua é que mudou. Mandar o
   * aviso automático transformaria uma decisão de produto numa acusação
   * pessoal, para todos os prestadores de uma vez. Os eventos gerados nos
   * últimos instantes ficam registrados no histórico, mas sem notificação.
   */
  delete from public.seal_events
   where notified_at is null and created_at >= now() - interval '1 minute';

  perform set_config('fixly.guard_bypass', 'off', true);
end $$;
