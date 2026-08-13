-- ============================================================
--  FIXLY — 0028: Selo Fixly com histórico + denúncias
--
--  1) SELO: até aqui ele era só uma CONTA feita na tela ("nota ≥ 4,5"). Isso
--     não dá para avisar ninguém — não existe o instante em que ele foi ganho
--     ou perdido. Agora o estado mora no banco (`profiles.seal_active`), muda
--     por trigger quando a nota muda, e cada virada vira uma linha em
--     `seal_events` — é o que o e-mail lê.
--     O admin pode REVOGAR (fraude, manipulação de avaliação, dano grave,
--     assédio, cobrança por fora) e a revogação vence o cálculo automático.
--  2) DENÚNCIAS: `reports`, abertas por qualquer uma das pontas.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  1) SELO
-- ════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists seal_active        boolean not null default false,
  add column if not exists seal_changed_at    timestamptz,
  add column if not exists seal_revoked_at    timestamptz,
  add column if not exists seal_revoked_reason text;

comment on column public.profiles.seal_active is
  'Selo Fixly ATIVO. Calculado por trigger (nota >= 4,5 com histórico) e derrubado por revogação do admin.';

/** Mesma regra do `lib/reputation.ts`: 4,5+ com pelo menos um serviço feito. */
create or replace function public.fixly_merece_selo(
  p_rating numeric, p_jobs int, p_revogado timestamptz
) returns boolean language sql immutable as $$
  select p_revogado is null
     and coalesce(p_jobs, 0) > 0
     and coalesce(p_rating, 0) >= 4.5;
$$;

create table if not exists public.seal_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  gained      boolean not null,           -- true = ganhou, false = perdeu
  reason      text,                       -- motivo quando é revogação do admin
  rating      numeric,
  jobs_done   int,
  notified_at timestamptz,                -- quando o e-mail saiu
  created_at  timestamptz not null default now()
);
create index if not exists idx_seal_events_pendentes
  on public.seal_events (profile_id, created_at desc) where notified_at is null;

alter table public.seal_events enable row level security;

-- o profissional vê o próprio histórico; admin vê tudo. Escrita só por trigger
-- (security definer) e por admin.
drop policy if exists seal_events_read on public.seal_events;
create policy seal_events_read on public.seal_events for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists seal_events_admin on public.seal_events;
create policy seal_events_admin on public.seal_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/**
 * Mantém `seal_active` e registra a virada.
 *
 * Roda depois de qualquer mudança em nota/serviços/revogação — inclusive a que
 * o trigger `on_request_completed` faz quando um serviço é aprovado. Como ele
 * mesmo escreve em `profiles`, precisa do bypass do `guard_profile_changes`
 * (selo é campo protegido: o usuário não pode se dar um selo).
 */
create or replace function public.fixly_sync_selo()
returns trigger language plpgsql security definer set search_path = public as $$
declare deveria boolean;
begin
  if new.role <> 'prestador' then return new; end if;

  deveria := public.fixly_merece_selo(new.rating, new.jobs_done, new.seal_revoked_at);
  if deveria = coalesce(new.seal_active, false) then return new; end if;

  new.seal_active := deveria;
  new.seal_changed_at := now();

  -- No INSERT a linha de `profiles` ainda não existe, e gravar o evento agora
  -- violaria a chave estrangeira. Conta nova também não "ganha" selo: nasce sem
  -- serviço concluído, então não há o que avisar.
  if tg_op = 'INSERT' then return new; end if;

  insert into public.seal_events (profile_id, gained, reason, rating, jobs_done)
  values (
    new.id,
    deveria,
    case
      when not deveria and new.seal_revoked_at is not null then coalesce(new.seal_revoked_reason, 'Revogado pela equipe Fixly')
      when not deveria then 'Média de avaliações abaixo de 4,5'
      else 'Média de avaliações 4,5 ou mais'
    end,
    new.rating,
    new.jobs_done
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_selo on public.profiles;
create trigger trg_sync_selo
  before insert or update of rating, jobs_done, seal_revoked_at, seal_revoked_reason
  on public.profiles
  for each row execute function public.fixly_sync_selo();

-- Estado inicial: quem já cumpre a regra hoje nasce com o selo ativo, SEM
-- gerar evento (ninguém "ganhou" agora — é só o retrato do que já valia).
do $$
begin
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.profiles p
     set seal_active = public.fixly_merece_selo(p.rating, p.jobs_done, p.seal_revoked_at),
         seal_changed_at = coalesce(p.seal_changed_at, now())
   where p.role = 'prestador'
     and p.seal_active is distinct from public.fixly_merece_selo(p.rating, p.jobs_done, p.seal_revoked_at);
  delete from public.seal_events where notified_at is null and created_at >= now() - interval '1 minute';
  perform set_config('fixly.guard_bypass', 'off', true);
end $$;

/** Revogar/devolver o selo — ato do admin, com motivo obrigatório na revogação. */
create or replace function public.set_seal_revocation(
  p_provider uuid, p_revogar boolean, p_reason text default null
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  if p_revogar and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Informe o motivo da revogação';
  end if;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.profiles
     set seal_revoked_at = case when p_revogar then now() else null end,
         seal_revoked_reason = case when p_revogar then btrim(p_reason) else null end
   where id = p_provider and role = 'prestador';
  perform set_config('fixly.guard_bypass', 'off', true);
  return true;
end;
$$;

/**
 * Selo e revogação entram na lista de campos que o próprio usuário não altera.
 *
 * ⚠️ Esta definição parte da versão do **0023** (a mais recente), só somando as
 * três colunas novas — redefinir a partir de uma versão antiga apagaria, em
 * silêncio, o que migrações posteriores fizeram (foi o que aconteceu com o
 * `dispatch_request` entre a 0021 e a 0023).
 */
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;
  if not public.is_admin() then
    if new.role <> old.role
       or new.status <> old.status
       or coalesce(new.active, true) <> coalesce(old.active, true)
       or coalesce(new.fix_badge, false) <> coalesce(old.fix_badge, false)
       or coalesce(new.rating, -1) is distinct from coalesce(old.rating, -1)
       or coalesce(new.jobs_done, -1) is distinct from coalesce(old.jobs_done, -1)
       or new.reviewed_at   is distinct from old.reviewed_at
       or new.reviewed_by   is distinct from old.reviewed_by
       or new.reject_reason is distinct from old.reject_reason
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

-- ════════════════════════════════════════════════════════════
--  2) DENÚNCIAS
-- ════════════════════════════════════════════════════════════

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  target_id    uuid not null references public.profiles(id) on delete cascade,
  request_id   uuid references public.service_requests(id) on delete set null,
  category     text not null,   -- fora_da_plataforma | fraude | dano | assedio | avaliacao | outro
  description  text not null,
  status       text not null default 'aberta',  -- aberta | em_analise | resolvida | arquivada
  resolution   text,
  handled_by   uuid references public.profiles(id),
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_reports_status on public.reports (status, created_at desc);
create index if not exists idx_reports_target on public.reports (target_id, created_at desc);

alter table public.reports enable row level security;

/**
 * Quem denunciou lê a própria denúncia; admin lê e trata todas.
 * O DENUNCIADO **não** vê — senão a denúncia vira retaliação, e o dono foi
 * claro em querer isso como canal seguro.
 */
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and target_id <> auth.uid()
    and (
      request_id is null
      or exists (
        select 1 from public.service_requests r
        where r.id = request_id
          and (r.client_id = auth.uid() or r.provider_id = auth.uid())
          and (r.client_id = target_id or r.provider_id = target_id)
      )
    )
  );

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant execute on function public.set_seal_revocation(uuid, boolean, text) to authenticated;
grant execute on function public.fixly_merece_selo(numeric, int, timestamptz) to authenticated;
