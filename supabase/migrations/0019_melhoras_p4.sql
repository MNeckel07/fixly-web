-- ============================================================
--  FIXLY — Melhoras (parte 4)
--  - Reputação começa em 0 (novo prestador sem Selo automático)
--  - Foto de perfil (avatar) + bucket público `avatars`
--  - Fotos no pedido (bucket público `pedidos`) + especialidades livres
--  - Adiantamento: % que o prestador recebe antes do serviço
--    (padrão no perfil + por proposta), refletido no pedido
--  - Empreiteiros: múltiplas especialidades + profiler público
--    (handle, fotos) para ter uma página igual à do prestador
-- ============================================================

-- ── 1) Reputação começa em 0 ────────────────────────────────
alter table public.profiles alter column rating set default 0;

-- Recalcula a média quando há avaliação; sem avaliações a nota é 0
-- (antes o fallback era 5.0 e todo novo prestador nascia "5 estrelas").
create or replace function public.on_request_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider_id is null then return new; end if;

  perform set_config('fixly.guard_bypass', 'on', true);

  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.profiles set jobs_done = coalesce(jobs_done, 0) + 1 where id = new.provider_id;
  end if;

  if new.rating is not null and new.rating is distinct from old.rating then
    update public.profiles p
      set rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.service_requests
        where provider_id = new.provider_id and rating is not null
      ), 0)
      where p.id = new.provider_id;
  end if;

  perform set_config('fixly.guard_bypass', 'off', true);
  return new;
end;
$$;

-- Zera a nota dos prestadores que ainda não fizeram nenhum serviço
-- (usa o bypass do guard porque `rating` é campo protegido).
do $$
begin
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.profiles
    set rating = 0
    where role = 'prestador' and coalesce(jobs_done, 0) = 0;
  perform set_config('fixly.guard_bypass', 'off', true);
end $$;

-- ── 2) Foto de perfil (avatar) + especialidades livres ──────
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists specialties text;

-- % de adiantamento padrão do prestador (0 = recebe tudo após concluir)
alter table public.profiles
  add column if not exists advance_pct int not null default 0;
alter table public.profiles drop constraint if exists profiles_advance_pct_chk;
alter table public.profiles
  add constraint profiles_advance_pct_chk check (advance_pct between 0 and 100);

-- ── 3) Adiantamento na proposta e no pedido ─────────────────
alter table public.proposals
  add column if not exists advance_pct int not null default 0;
alter table public.service_requests
  add column if not exists advance_pct int not null default 0;

-- Fotos anexadas ao pedido (caminhos no bucket público `pedidos`)
alter table public.service_requests
  add column if not exists photos text[] not null default '{}';

-- Espelho do adiantamento no pagamento (para o extrato)
alter table public.payments add column if not exists advance_pct int;
alter table public.payments add column if not exists advance_amount numeric(10,2);
alter table public.payments add column if not exists advance_fee numeric(10,2);

-- ── 4) Buckets: avatars (público — vitrine) e fotos de pedido (PRIVADO) ──
-- avatar é vitrine pública; fotos do pedido são privadas (casa/serviço do
-- contratante) — acessadas só por URL assinada, por quem tem direito.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('pedidos', 'pedidos', false)
on conflict (id) do nothing;
-- garante que `pedidos` seja privado mesmo se já existir de execução anterior
update storage.buckets set public = false where id = 'pedidos';

-- avatar: cada um só grava na sua própria pasta (nome = <uid>/...)
drop policy if exists avatars_upload on storage.objects;
create policy avatars_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_modify on storage.objects;
create policy avatars_modify on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- quem pode ver as fotos de um pedido (mesma regra do req_select):
-- o contratante dono, o prestador designado, prestadores aprovados (pedido
-- aberto) e o admin. SECURITY DEFINER para não recair no RLS de service_requests.
create or replace function public.can_view_pedido(p_request uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.service_requests r
    where r.id = p_request and (
      r.client_id = auth.uid()
      or r.provider_id = auth.uid()
      or public.is_admin()
      or (r.provider_id is null and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'prestador' and p.status = 'aprovado'))
    )
  );
$$;

-- fotos do pedido: o contratante grava na sua pasta (nome = <uid>/<request_id>/...)
drop policy if exists pedidos_upload on storage.objects;
create policy pedidos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'pedidos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists pedidos_modify on storage.objects;
create policy pedidos_modify on storage.objects for update to authenticated
  using (bucket_id = 'pedidos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists pedidos_delete on storage.objects;
create policy pedidos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pedidos' and (storage.foldername(name))[1] = auth.uid()::text);
-- LEITURA controlada (bucket privado → só quem tem direito consegue assinar a URL)
drop policy if exists pedidos_read on storage.objects;
create policy pedidos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'pedidos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_view_pedido(nullif((storage.foldername(name))[2], '')::uuid)
    )
  );

-- ── 5) submit_proposal aceita o % de adiantamento ──────────
-- remove a versão anterior (4 args) para não deixar overload pendente
drop function if exists public.submit_proposal(uuid, numeric, int, text);

create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text, p_advance_pct int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já foi atribuído'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem propor';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'Informe um valor válido'; end if;

  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status, advance_pct)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada',
          least(greatest(coalesce(p_advance_pct, 0), 0), 100))
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada',
                  advance_pct = excluded.advance_pct;

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

-- Disparo automático copia o adiantamento padrão do prestador para a proposta.
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  price numeric;
  cnt int := 0;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      and (
        r.category_id is null
        or p.category_id = r.category_id
        or exists (select 1 from public.provider_categories pc
                   where pc.provider_id = p.id and pc.category_id = r.category_id)
      )
    order by
      case when p.lat is not null and r.lat is not null
        then power(r.lat - p.lat, 2) + power(r.lng - p.lng, 2) else 999 end
    limit 8
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;

    if dist > coalesce(prov.service_radius_km, 10) then
      continue;
    end if;

    price := coalesce(prov.base_price, 100)
             * (case when r.urgent then 1.3 else 1 end)
             + round(dist * 2)
             + round((random() * 30 - 10)::numeric);

    insert into public.proposals (request_id, provider_id, price, eta_minutes, status, advance_pct)
    values (p_request_id, prov.id, greatest(round(price::numeric, 2), 50),
            greatest(10, round(dist * 4 + random() * 20)::int), 'enviada',
            coalesce(prov.advance_pct, 0))
    on conflict (request_id, provider_id) do nothing;
    cnt := cnt + 1;
  end loop;

  if cnt > 0 then
    update public.service_requests set status = 'proposta_enviada' where id = p_request_id;
  end if;
  return cnt;
end;
$$;

-- ── 6) Empreiteiros: múltiplas especialidades + profiler ────
alter table public.empreiteiros
  add column if not exists category_ids uuid[] not null default '{}';
alter table public.empreiteiros
  add column if not exists handle text;
create unique index if not exists idx_empreiteiros_handle
  on public.empreiteiros (lower(handle)) where handle is not null;

-- Fotos do empreiteiro (portfólio da empresa) — reusa o bucket público `portfolio`
create table if not exists public.empreiteiro_items (
  id             uuid primary key default gen_random_uuid(),
  empreiteiro_id uuid not null references public.empreiteiros(id) on delete cascade,
  image_path     text not null,
  caption        text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_empreiteiro_items on public.empreiteiro_items(empreiteiro_id, created_at desc);

alter table public.empreiteiro_items enable row level security;
drop policy if exists ei_read on public.empreiteiro_items;
create policy ei_read on public.empreiteiro_items for select using (true);
drop policy if exists ei_write on public.empreiteiro_items;
create policy ei_write on public.empreiteiro_items for all
  using (exists (select 1 from public.empreiteiros e where e.id = empreiteiro_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.empreiteiros e where e.id = empreiteiro_id and e.owner_id = auth.uid()));
