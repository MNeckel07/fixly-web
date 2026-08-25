-- ============================================================
--  0035 — RESTAURA A PROTEÇÃO DO SELO NO GUARD DE PERFIL
--
--  A REGRESSÃO
--  -----------
--  A 0033 fechou a escalada de privilégio no INSERT (correta e necessária),
--  mas reescreveu `guard_profile_changes` partindo da versão da **0006**, e não
--  da mais recente (**0028**). O ramo de UPDATE voltou a proteger 8 colunas,
--  quando protegia 12. Sumiram, em silêncio:
--
--      fix_badge · seal_active · seal_revoked_at · seal_revoked_reason
--
--  Com isso, um `PATCH /rest/v1/profiles?id=eq.<uid>` com `{"seal_active":true}`
--  passava a valer: o prestador se dava o Selo Fixly, que é o principal sinal
--  de confiança da plataforma (aparece em `/p/<handle>` e no cartão da
--  carteira). `trg_sync_selo` não salvava a situação porque é escopado por
--  coluna (`update OF rating, jobs_done, seal_revoked_at, seal_revoked_reason`):
--  um update que toca SÓ `seal_active` não o dispara. Pelo mesmo caminho dava
--  para limpar `seal_revoked_at` e desfazer uma revogação do admin, e para
--  ligar o próprio `fix_badge` — que o `setFixBadge` confia ao guard.
--
--  É exatamente a armadilha que a 0028 avisa no cabeçalho e que a 0025 já
--  registrou como lição depois de acontecer com o `dispatch_request`:
--  ⚠️ ao redefinir uma função, partir da versão de MAIOR número
--  (`grep -rn "function public.<nome>" supabase/migrations`), nunca da primeira.
--
--  O QUE ESTA MIGRAÇÃO FAZ
--  ----------------------
--  1. Devolve as quatro colunas ao ramo de UPDATE (versão 0028 completa).
--  2. Estende a mesma proteção ao ramo de INSERT: cadastro não nasce com selo,
--     com Selo Fix nem com revogação preenchida.
--  3. Troca o reconhecimento de contexto confiável. A 0033 usou só
--     `auth.role() = 'service_role'`, idioma novo neste banco: o projeto usa as
--     chaves novas do Supabase (`sb_publishable_`/`SUPABASE_SECRET_KEY`), que
--     não são JWT, e se o claim `role` não chegar ao Postgres a função devolve
--     NULL — o guard passaria a valer para a chave de serviço e o
--     `createStaffUser` quebraria ao criar um admin. Aqui o sinal primário é
--     `auth.uid() is null`, o mesmo que o `guard_request_changes` (0022) usa há
--     tempo neste banco, com `auth.role()` como reforço. Continua seguro porque
--     o anônimo nunca chega até aqui: a RLS de INSERT exige `id = auth.uid()`,
--     e `id = NULL` não é verdadeiro.
--  4. Passa a tratar a chave de serviço como confiável TAMBÉM no UPDATE. Ela já
--     ignora RLS por definição — guardá-la era teatro, e cobrava o preço de
--     quebrar o `createStaffUser` no dia em que ele caísse no caminho do
--     `ON CONFLICT DO UPDATE`. As únicas escritas privilegiadas em `profiles`
--     são `createStaffUser` e `updateStaffPermissions`, ambas atrás de
--     `assertAdmin`.
--
--  O que NÃO muda: `setUserActive` e `setFixBadge` continuam usando o client da
--  SESSÃO de propósito, para que `is_admin()` seja verdadeiro e o guard libere.
-- ============================================================

-- ── 1) Policy de INSERT: a mesma redundância que a 0033 promete ──
drop policy if exists prof_insert on public.profiles;
create policy prof_insert on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role <> 'admin'
    and status = 'pendente'
    and coalesce(fix_badge, false) = false
    and coalesce(seal_active, false) = false
    and seal_revoked_at is null
  );

-- ── 2) Guard completo (base: 0028 + ramo de INSERT da 0033) ──
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confiavel boolean;
begin
  -- Triggers internos confiáveis sinalizam bypass ao recalcular reputação/selo.
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;

  -- Contexto confiável = service_role (server action com a chave secret).
  -- `auth.uid() is null` é o sinal comprovado neste banco desde a 0022;
  -- `auth.role()` entra como reforço e nunca sozinho.
  v_confiavel := auth.uid() is null or coalesce(auth.role(), '') = 'service_role';

  -- ── INSERT: valida VALORES ABSOLUTOS (não há `old` para comparar) ──
  if tg_op = 'INSERT' then
    if not v_confiavel then
      if new.id is distinct from auth.uid()
         or new.role = 'admin'
         or new.status <> 'pendente'
         or coalesce(new.active, true) <> true
         or coalesce(new.rating, 0) <> 0
         or coalesce(new.jobs_done, 0) <> 0
         or new.reviewed_at   is not null
         or new.reviewed_by   is not null
         or new.reject_reason is not null
         -- devolvidas pela 0035:
         or coalesce(new.fix_badge, false)   <> false
         or coalesce(new.seal_active, false) <> false
         or new.seal_revoked_at     is not null
         or new.seal_revoked_reason is not null
      then
        raise exception 'Valores protegidos não permitidos no cadastro';
      end if;
    end if;

    return new;
  end if;

  -- ── UPDATE: compara com `old` (versão 0028, completa) ──
  if not (v_confiavel or public.is_admin()) then
    if new.role <> old.role
       or new.status <> old.status
       or coalesce(new.active, true) <> coalesce(old.active, true)
       or coalesce(new.rating, -1)     is distinct from coalesce(old.rating, -1)
       or coalesce(new.jobs_done, -1)  is distinct from coalesce(old.jobs_done, -1)
       or new.reviewed_at   is distinct from old.reviewed_at
       or new.reviewed_by   is distinct from old.reviewed_by
       or new.reject_reason is distinct from old.reject_reason
       -- devolvidas pela 0035:
       or coalesce(new.fix_badge, false)   <> coalesce(old.fix_badge, false)
       or coalesce(new.seal_active, false) <> coalesce(old.seal_active, false)
       or new.seal_revoked_at     is distinct from old.seal_revoked_at
       or new.seal_revoked_reason is distinct from old.seal_revoked_reason
    then
      raise exception 'Alteração de campos protegidos não permitida';
    end if;
  end if;

  return new;
end;
$$;

-- ⚠️ O nome importa: os triggers BEFORE do Postgres rodam em ordem ALFABÉTICA.
-- `trg_guard_profile` < `trg_sync_selo`, então o guard enxerga o valor que o
-- usuário mandou, antes de o sync recalcular o selo. Renomear qualquer um dos
-- dois pode inverter a ordem e furar a proteção.
drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile
  before insert or update on public.profiles
  for each row execute function public.guard_profile_changes();
