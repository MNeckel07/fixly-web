-- ============================================================
--  FIXLY — Pré-orçamento (faixa) e contra-proposta do prestador
--  - pricing_rules: parâmetros por categoria (admin configura)
--  - service_requests.estimated_min/max: faixa mostrada ao cliente
--  - submit_proposal(): prestador propõe valor (teto 15% acima do máx)
-- ============================================================

create table if not exists public.pricing_rules (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid unique references public.service_categories(id) on delete cascade,
  base_min          numeric(10,2) not null default 80,
  base_max          numeric(10,2) not null default 150,
  per_km            numeric(10,2) not null default 3.5,
  urgent_multiplier numeric(4,2)  not null default 1.4,
  created_at        timestamptz not null default now()
);

-- semente a partir das categorias existentes
insert into public.pricing_rules (category_id, base_min, base_max)
select id, round(base_price * 0.85), round(base_price * 1.4)
from public.service_categories
on conflict (category_id) do nothing;

alter table public.pricing_rules enable row level security;
drop policy if exists pr_read on public.pricing_rules;
create policy pr_read on public.pricing_rules for select using (true);
drop policy if exists pr_write on public.pricing_rules;
create policy pr_write on public.pricing_rules for all using (public.is_admin()) with check (public.is_admin());

-- faixa de pré-orçamento no pedido
alter table public.service_requests
  add column if not exists estimated_min numeric(10,2),
  add column if not exists estimated_max numeric(10,2);

-- ── Contra-proposta do prestador (teto: 15% acima do máx) ───
create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.service_requests; cap numeric;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já foi atribuído'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem propor';
  end if;

  cap := coalesce(r.estimated_max, r.estimated_price, 999999) * 1.15;
  if p_price > cap then
    raise exception 'Valor acima do limite (máximo 15%% acima do pré-orçamento: R$ %)', round(cap, 2);
  end if;
  if p_price <= 0 then raise exception 'Valor inválido'; end if;

  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada')
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada';

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;
grant execute on function public.submit_proposal(uuid, numeric, int, text) to authenticated;
