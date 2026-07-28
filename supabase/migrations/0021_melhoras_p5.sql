-- ============================================================
--  FIXLY — Melhoras (parte 5)
--  - Catálogo: destacar 8 serviços + esconder Banheiros e fundir
--    "faz-tudo" no "marido de aluguel" (via flags, sem deletar dado)
--  - Express: prestador SEMPRE digita o preço (dispatch não cria mais
--    proposta automática com valor)
--  - Adiantamento: teto de 50% + aprovação do contratante
--  - Contra-proposta do contratante (negociar preço)
-- ============================================================

-- ── 1) Catálogo: destaque + ocultar ────────────────────────
alter table public.service_categories add column if not exists featured boolean not null default false;
alter table public.service_categories add column if not exists hidden   boolean not null default false;

-- destaca os 8 escolhidos
update public.service_categories set featured = true
  where slug in ('eletricista','encanador','marido_aluguel','gesso','marcenaria','pintor','pisos','pequenos_reparos');
-- garante que o resto não fique "featured"
update public.service_categories set featured = false
  where slug not in ('eletricista','encanador','marido_aluguel','gesso','marcenaria','pintor','pisos','pequenos_reparos');

-- esconde Banheiros e funde faz-tudo no marido de aluguel
update public.service_categories set hidden = true  where slug in ('banheiros','faz_tudo');
update public.service_categories set hidden = false where slug not in ('banheiros','faz_tudo');

-- ── 2) Adiantamento: aprovação do contratante ──────────────
-- advance_pct já existe (0019). Aqui: teto 50% e flag de aprovação.
alter table public.service_requests
  add column if not exists advance_approved boolean not null default false;
-- teto de 50% também no dado existente
update public.service_requests set advance_pct = 50 where advance_pct > 50;
update public.profiles set advance_pct = 50 where advance_pct > 50;

-- ── 3) Contra-proposta (contratante negocia o preço) ───────
-- texto livre em vez de novo valor de enum (evita ALTER TYPE)
alter table public.proposals add column if not exists counter_price  numeric(10,2);
alter table public.proposals add column if not exists counter_status text; -- null | pendente | aceita | recusada

-- ── 4) submit_proposal: teto de adiantamento em 50% ────────
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
          least(greatest(coalesce(p_advance_pct, 0), 0), 50))
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada',
                  advance_pct = excluded.advance_pct;

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

-- ── 5) dispatch_request: SEM proposta automática ───────────
-- No Express o preço é do prestador. O dispatch apenas conta os
-- profissionais elegíveis (aptos, no raio, categoria e NÃO ocupados)
-- para dar feedback; a visibilidade do pedido é garantida pelo RLS
-- (0007). O prestador é quem envia a proposta com o seu preço.
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
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
      -- não conta quem já está ocupado com um serviço em andamento
      and not exists (
        select 1 from public.service_requests s
        where s.provider_id = p.id and s.status in ('a_caminho','em_andamento')
      )
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;
    if dist > coalesce(prov.service_radius_km, 10) then continue; end if;
    cnt := cnt + 1;
  end loop;

  -- mantém o pedido em 'buscando'; vira 'proposta_enviada' quando um
  -- prestador realmente enviar a proposta (submit_proposal).
  return cnt;
end;
$$;
