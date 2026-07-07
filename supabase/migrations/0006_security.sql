-- ============================================================
--  FIXLY — Blindagem de segurança
--  1) Separa PII/dados bancários em profiles_private (dono+admin)
--  2) Protege campos de reputação/moderação (nota, jobs, status...)
--  3) Reputação (nota/nº serviços) calculada por trigger confiável
--  4) Escrita de pagamentos restrita ao servidor (admin/service key)
-- ============================================================

-- ── 1) Tabela de dados sensíveis ────────────────────────────
create table if not exists public.profiles_private (
  id                uuid primary key references public.profiles(id) on delete cascade,
  email             text,
  phone             text,
  cpf               text,
  rg                text,
  birth_date        date,
  gender            text,
  address           text,
  address_number    text,
  complement        text,
  neighborhood      text,
  zip_code          text,
  bank_name         text,
  bank_agency       text,
  bank_account      text,
  bank_account_type text,
  pix_key           text
);

-- migra os dados já existentes (se as colunas ainda existirem em profiles)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='profiles' and column_name='cpf') then
    insert into public.profiles_private
      (id, email, phone, cpf, rg, birth_date, gender, address, address_number,
       complement, neighborhood, zip_code, bank_name, bank_agency, bank_account,
       bank_account_type, pix_key)
    select id, email, phone, cpf, rg, birth_date, gender, address, address_number,
       complement, neighborhood, zip_code, bank_name, bank_agency, bank_account,
       bank_account_type, pix_key
    from public.profiles
    on conflict (id) do nothing;
  end if;
end $$;

alter table public.profiles_private enable row level security;
drop policy if exists pp_select on public.profiles_private;
create policy pp_select on public.profiles_private for select using (id = auth.uid() or public.is_admin());
drop policy if exists pp_insert on public.profiles_private;
create policy pp_insert on public.profiles_private for insert with check (id = auth.uid() or public.is_admin());
drop policy if exists pp_update on public.profiles_private;
create policy pp_update on public.profiles_private for update using (id = auth.uid() or public.is_admin());

-- remove as colunas sensíveis de profiles (agora vivem em profiles_private)
alter table public.profiles
  drop column if exists email,
  drop column if exists phone,
  drop column if exists cpf,
  drop column if exists rg,
  drop column if exists birth_date,
  drop column if exists gender,
  drop column if exists address,
  drop column if exists address_number,
  drop column if exists complement,
  drop column if exists neighborhood,
  drop column if exists zip_code,
  drop column if exists bank_name,
  drop column if exists bank_agency,
  drop column if exists bank_account,
  drop column if exists bank_account_type,
  drop column if exists pix_key;

-- ── 2) Guard: protege campos de reputação/moderação ─────────
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- triggers confiáveis podem sinalizar bypass
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;
  if not public.is_admin() then
    if new.role <> old.role
       or new.status <> old.status
       or coalesce(new.active, true) <> coalesce(old.active, true)
       or coalesce(new.rating, -1) is distinct from coalesce(old.rating, -1)
       or coalesce(new.jobs_done, -1) is distinct from coalesce(old.jobs_done, -1)
       or new.reviewed_at   is distinct from old.reviewed_at
       or new.reviewed_by   is distinct from old.reviewed_by
       or new.reject_reason is distinct from old.reject_reason
    then
      raise exception 'Alteração de campos protegidos não permitida';
    end if;
  end if;
  return new;
end;
$$;

-- ── 3) Reputação por trigger (não editável pelo usuário) ────
create or replace function public.on_request_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider_id is null then return new; end if;

  perform set_config('fixly.guard_bypass', 'on', true);

  -- incrementa nº de serviços ao concluir
  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.profiles set jobs_done = coalesce(jobs_done, 0) + 1 where id = new.provider_id;
  end if;

  -- recalcula a média de avaliação quando uma nota é registrada
  if new.rating is not null and new.rating is distinct from old.rating then
    update public.profiles p
      set rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.service_requests
        where provider_id = new.provider_id and rating is not null
      ), 5.0)
      where p.id = new.provider_id;
  end if;

  perform set_config('fixly.guard_bypass', 'off', true);
  return new;
end;
$$;

drop trigger if exists trg_request_completed on public.service_requests;
create trigger trg_request_completed
  after update on public.service_requests
  for each row execute function public.on_request_completed();

-- ── 4) Pagamentos: escrita só pelo servidor (admin/service) ─
drop policy if exists pay_write on public.payments;
create policy pay_write on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());
-- leitura permanece para admin, cliente e prestador do pedido (pay_select)
